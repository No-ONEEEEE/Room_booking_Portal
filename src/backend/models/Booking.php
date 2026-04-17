<?php

class Booking {
    private $pdo;

    const MAX_BOOKING_DURATION_SECONDS = 14400;
    const MAX_PURPOSE_LENGTH = 255;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function findById($id) {

        $stmt = $this->pdo->prepare("
            SELECT 
                b.id,
                b.user_id,
                b.room_id,
                b.start_time,
                b.end_time,
                b.purpose,
                b.expected_people,
                b.remarks,
                b.snacks_requested,
                b.refreshment_details,
                b.status,
                b.decline_reason,
                b.clarification_notes,
                b.clarification_response,
                b.created_at,

                u.name AS user_name,
                u.email AS user_email,

                r.room_name,
                r.type AS room_type,
                r.capacity AS room_capacity

            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN rooms r ON b.room_id = r.id
            WHERE b.id = ?
        ");

        $stmt->execute([$id]);

        $booking = $stmt->fetch();

        if (!$booking) {
            return null;
        }

        $guestStmt = $this->pdo->prepare("
            SELECT u.id, u.name, u.email
            FROM booking_guests bg
            JOIN users u ON bg.user_id = u.id
            WHERE bg.booking_id = ?
        ");

        $guestStmt->execute([$id]);

        $booking['guests'] = $guestStmt->fetchAll();

        return $booking;
    }

    public function create(
        $userId,
        $roomId,
        $startTime,
        $endTime,
        $purpose,
        $expectedPeople,
        $snacksRequested = false,
        $refreshmentDetails = null,
        $remarks = null,
        $guests = []
    ) {

        if (!$userId || !$roomId || !$startTime || !$endTime) {
            return ['error' => 'missing_fields'];
        }

        $purpose = trim($purpose);

        if ($purpose === '') {
            return ['error' => 'empty_purpose'];
        }

        if (strlen($purpose) > self::MAX_PURPOSE_LENGTH) {
            return ['error' => 'purpose_too_long'];
        }

        $this->pdo->beginTransaction();

        try {

            $conflictStmt = $this->pdo->prepare("
                SELECT 1
                FROM bookings
                WHERE room_id = ?
                AND status IN ('pending','approved')
                AND start_time < ?
                AND end_time > ?
                LIMIT 1
            ");

            $conflictStmt->execute([$roomId, $endTime, $startTime]);

            if ($conflictStmt->fetch()) {
                $this->pdo->rollBack();
                return ['error' => 'conflict'];
            }

            if (!empty($guests)) {

                $guests = array_unique($guests);

                $placeholders = implode(',', array_fill(0, count($guests), '?'));

                $guestCheck = $this->pdo->prepare("
                    SELECT id FROM users
                    WHERE id IN ($placeholders)
                ");

                $guestCheck->execute($guests);

                $validGuests = $guestCheck->fetchAll(PDO::FETCH_COLUMN);

                if (count($validGuests) !== count($guests)) {
                    $this->pdo->rollBack();
                    return ['error' => 'invalid_guest'];
                }
            }

            $stmt = $this->pdo->prepare("
                INSERT INTO bookings
                (
                    user_id,
                    room_id,
                    start_time,
                    end_time,
                    purpose,
                    expected_people,
                    remarks,
                    snacks_requested,
                    refreshment_details,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ");

            $stmt->execute([
                $userId,
                $roomId,
                $startTime,
                $endTime,
                $purpose,
                $expectedPeople,
                $remarks,
                $snacksRequested ? 1 : 0,
                $refreshmentDetails ? json_encode($refreshmentDetails) : null
            ]);

            $bookingId = (int)$this->pdo->lastInsertId();

            if (!empty($guests)) {

                $guestStmt = $this->pdo->prepare("
                    INSERT INTO booking_guests
                    (booking_id, user_id)
                    VALUES (?, ?)
                ");

                foreach ($guests as $guestId) {

                    if ($guestId == $userId) {
                        continue;
                    }

                    $guestStmt->execute([$bookingId, $guestId]);
                }
            }

            $this->pdo->commit();

            return [
                'booking_id' => $bookingId
            ];

        } catch (Exception $e) {

            $this->pdo->rollBack();
            return ['error' => 'conflict'];
        }
    }

    public function approve($bookingId) {
        $this->pdo->beginTransaction();

        try {

            $stmt = $this->pdo->prepare("
                SELECT *
                FROM bookings
                WHERE id = ?
                FOR UPDATE
            ");

            $stmt->execute([$bookingId]);
            $booking = $stmt->fetch();

            if (!$booking) {
                $this->pdo->rollBack();
                return null;
            }

            if ($booking['status'] !== 'pending') {
                $this->pdo->rollBack();
                return false;
            }

            if (strtotime($booking['start_time']) <= time()) {
                $this->pdo->rollBack();
                return false;
            }

            $conflictStmt = $this->pdo->prepare("
                SELECT 1
                FROM bookings
                WHERE room_id = ?
                AND status = 'approved'
                AND id != ?
                AND start_time < ?
                AND end_time > ?
                LIMIT 1
            ");

            $conflictStmt->execute([
                $booking['room_id'],
                $bookingId,
                $booking['end_time'],
                $booking['start_time']
            ]);

            if ($conflictStmt->fetch()) {
                $this->pdo->rollBack();
                return false;
            }

            $updateStmt = $this->pdo->prepare("
                UPDATE bookings
                SET status = 'approved'
                WHERE id = ?
            ");

            $updateStmt->execute([$bookingId]);

            $this->pdo->commit();
            return true;

        } catch (Exception $e) {
            $this->pdo->rollBack();
            return false;
        }
    }

    public function decline($bookingId, $reason) {
        $stmt = $this->pdo->prepare("
            SELECT id, status
            FROM bookings
            WHERE id = ?
        ");

        $stmt->execute([$bookingId]);
        $booking = $stmt->fetch();

        if (!$booking) {
            return null;
        }

        if ($booking['status'] !== 'pending') {
            return false;
        }

        $updateStmt = $this->pdo->prepare("
            UPDATE bookings
            SET status = 'declined',
                decline_reason = ?
            WHERE id = ?
        ");

        $updateStmt->execute([$reason, $bookingId]);

        return true;
    }

    public function requestMoreDetails($bookingId, $notes) {
        $stmt = $this->pdo->prepare("
            SELECT id, status
            FROM bookings
            WHERE id = ?
            AND status = 'pending'
        ");

        $stmt->execute([$bookingId]);
        $booking = $stmt->fetch();

        if (!$booking) {
            return null;
        }

        if ($booking['status'] !== 'pending') {
            return false;
        }

        $updateStmt = $this->pdo->prepare("
            UPDATE bookings
            SET clarification_notes = ?
            WHERE id = ?
        ");

        $updateStmt->execute([$notes, $bookingId]);

        return true;
    }

    public function provideClarification($bookingId, $response) {
        $stmt = $this->pdo->prepare("
            SELECT id, status
            FROM bookings
            WHERE id = ?
            AND status = 'pending'
        ");

        $stmt->execute([$bookingId]);
        $booking = $stmt->fetch();

        if (!$booking) {
            return null;
        }

        $updateStmt = $this->pdo->prepare("
            UPDATE bookings
            SET clarification_response = ?
            WHERE id = ?
        ");

        $updateStmt->execute([$response, $bookingId]);

        return true;
    }

    public function cancel($bookingId) {

        $stmt = $this->pdo->prepare("
            UPDATE bookings
            SET status = 'cancelled'
            WHERE id = ?
        ");

        $stmt->execute([$bookingId]);

        return $stmt->rowCount() > 0;
    }

    public function getBookingsForFilter($startDate = null, $endDate = null, $status = null, $roomId = null, $userId = null) {
        $query = "
            SELECT 
                b.id,
                b.start_time,
                b.end_time,
                b.purpose,
                b.expected_people,
                b.snacks_requested,
                b.refreshment_details,
                b.status,

                u.id AS user_id,
                u.name AS user_name,

                r.id AS room_id,
                r.room_name,
                r.type AS room_type

            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN rooms r ON b.room_id = r.id
            WHERE 1 = 1
        ";

        $params = [];

        if ($startDate !== null && $endDate !== null) {
            $query .= " AND b.start_time < ? AND b.end_time > ?";
            $params[] = $endDate;
            $params[] = $startDate;
        }

        if ($status !== null) {
            $query .= " AND b.status = ?";
            $params[] = $status;
        }

        if ($roomId !== null) {
            $query .= " AND b.room_id = ?";
            $params[] = $roomId;
        }

        if ($userId !== null) {
            $query .= " AND b.user_id = ?";
            $params[] = $userId;
        }

        // Fix: Ensure we don't show pending bookings from previous days in the Admin Panel/Default views
        if ($status === 'pending' && $startDate === null && $endDate === null) {
            $query .= " AND DATE(b.start_time) >= CURRENT_DATE()";
        }

        $query .= " ORDER BY b.start_time ASC, b.id ASC";

        $stmt = $this->pdo->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    public function getStatistics($startDate = null, $endDate = null, $status = null, $roomId = null) {
        $where = " WHERE 1 = 1 ";
        $params = [];

        if ($startDate !== null) {
            $where .= " AND start_time >= ? ";
            $params[] = $startDate;
        }

        if ($endDate !== null) {
            $where .= " AND end_time <= ? ";
            $params[] = $endDate;
        }

        if ($status !== null) {
            $where .= " AND status = ? ";
            $params[] = $status;
        }

        if ($roomId !== null) {
            $where .= " AND room_id = ? ";
            $params[] = $roomId;
        }

        $totalsStmt = $this->pdo->prepare("
            SELECT
                COUNT(*) AS total_bookings,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) AS declined_count,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
            FROM bookings
            $where
        ");

        $totalsStmt->execute($params);
        $totals = $totalsStmt->fetch();

        $roomStmt = $this->pdo->prepare("
            SELECT r.room_name, COUNT(*) AS booking_count
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            $where
            GROUP BY b.room_id, r.room_name
            ORDER BY booking_count DESC, r.room_name ASC
        ");

        $roomStmt->execute($params);
        $byRoom = $roomStmt->fetchAll();

        $monthlyStmt = $this->pdo->prepare("
            SELECT DATE_FORMAT(start_time, '%Y-%m') AS month, COUNT(*) AS booking_count
            FROM bookings
            $where
            GROUP BY DATE_FORMAT(start_time, '%Y-%m')
            ORDER BY month ASC
        ");

        $monthlyStmt->execute($params);
        $monthly = $monthlyStmt->fetchAll();

        return [
            'totals' => $totals,
            'by_room' => $byRoom,
            'monthly' => $monthly
        ];
    }

    public function markCompleted($bookingId) {
        $stmt = $this->pdo->prepare("
            UPDATE bookings
            SET status = 'completed'
            WHERE id = ? 
            AND status = 'approved'
            AND end_time <= NOW()
        ");

        $stmt->execute([$bookingId]);

        return $stmt->rowCount() > 0;
    }

    public function update(
        $bookingId,
        $roomId,
        $startTime,
        $endTime,
        $purpose = null,
        $expectedPeople = null,
        $snacksRequested = null,
        $refreshmentDetails = null,
        $remarks = null,
        $guests = null
    ) {

        $this->pdo->beginTransaction();

        try {

            $stmt = $this->pdo->prepare("
                SELECT status
                FROM bookings
                WHERE id = ?
                FOR UPDATE
            ");

            $stmt->execute([$bookingId]);
            $booking = $stmt->fetch();

            if (!$booking) {
                $this->pdo->rollBack();
                return null;
            }

            $resetApproval = false;

            if ($booking['status'] === 'approved') {
                $resetApproval = true;
            }

            $conflictStmt = $this->pdo->prepare("
                SELECT 1
                FROM bookings
                WHERE room_id = ?
                AND status IN ('pending','approved')
                AND id != ?
                AND start_time < ?
                AND end_time > ?
                LIMIT 1
            ");

            $conflictStmt->execute([$roomId, $bookingId, $endTime, $startTime]);

            if ($conflictStmt->fetch()) {
                $this->pdo->rollBack();
                return false;
            }

            $fields = [];
            $params = [];

            if ($startTime !== null) {
                $fields[] = "start_time = ?";
                $params[] = $startTime;
            }

            if ($endTime !== null) {
                $fields[] = "end_time = ?";
                $params[] = $endTime;
            }

            if ($purpose !== null) {

                $purpose = trim($purpose);

                if ($purpose === '') {
                    $this->pdo->rollBack();
                    return false;
                }

                if (strlen($purpose) > self::MAX_PURPOSE_LENGTH) {
                    $this->pdo->rollBack();
                    return false;
                }

                $fields[] = "purpose = ?";
                $params[] = $purpose;
            }

            if ($expectedPeople !== null) {
                $fields[] = "expected_people = ?";
                $params[] = $expectedPeople;
            }

            if ($snacksRequested !== null) {
                $fields[] = "snacks_requested = ?";
                $params[] = $snacksRequested ? 1 : 0;
            }

            if ($remarks !== null) {
                $fields[] = "remarks = ?";
                $params[] = $remarks;
            }
            
            if ($refreshmentDetails !== null) {
                $fields[] = "refreshment_details = ?";
                $params[] = $refreshmentDetails ? json_encode($refreshmentDetails) : null;
            }

            if ($resetApproval) {
                $fields[] = "status = 'pending'";
                $fields[] = "decline_reason = NULL";
                $fields[] = "clarification_notes = NULL";
            }

            if ($fields) {

                $params[] = $bookingId;

                $query = "
                    UPDATE bookings
                    SET " . implode(", ", $fields) . "
                    WHERE id = ?
                ";

                $stmt = $this->pdo->prepare($query);
                $stmt->execute($params);
            }

            if ($guests !== null) {

                $guests = array_unique($guests);

                if ($guests) {

                    $placeholders = implode(',', array_fill(0, count($guests), '?'));

                    $checkStmt = $this->pdo->prepare("
                        SELECT id
                        FROM users
                        WHERE id IN ($placeholders)
                    ");

                    $checkStmt->execute($guests);

                    $validGuests = $checkStmt->fetchAll(PDO::FETCH_COLUMN);

                    if (count($validGuests) !== count($guests)) {
                        $this->pdo->rollBack();
                        return false;
                    }
                }

                $deleteStmt = $this->pdo->prepare("
                    DELETE FROM booking_guests
                    WHERE booking_id = ?
                ");

                $deleteStmt->execute([$bookingId]);

                if ($guests) {

                    $insertStmt = $this->pdo->prepare("
                        INSERT INTO booking_guests
                        (booking_id, user_id)
                        VALUES (?, ?)
                    ");

                    foreach ($guests as $guestId) {
                        $insertStmt->execute([$bookingId, $guestId]);
                    }
                }
            }

            $this->pdo->commit();

            return true;

        } catch (Exception $e) {

            $this->pdo->rollBack();
            return false;
        }
    }
}