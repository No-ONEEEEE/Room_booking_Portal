<?php

class Room {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getRooms($type = null, $capacity = null) {
        $validTypes = ['classroom', 'meeting'];

        if ($type !== null && !in_array($type, $validTypes)) {
            return ['error' => 'invalid_type'];
        }

        if ($capacity !== null) {
            if (!ctype_digit((string)$capacity) || $capacity < 1) {
                return ['error' => 'invalid_capacity'];
            }
        }

        $query = "SELECT * FROM rooms WHERE 1=1";
        $params = [];

        if ($type !== null) {
            $query .= " AND type = ?";
            $params[] = $type;
        }

        if ($capacity !== null) {
            $query .= " AND capacity >= ?";
            $params[] = $capacity;
        }

        $query .= " ORDER BY id ASC";

        try {
            $stmt = $this->pdo->prepare($query);
            $stmt->execute($params);

            return $stmt->fetchAll(PDO::FETCH_ASSOC);

        } catch (PDOException $e) {
            return ['error' => 'database_error'];
        }
    }

    public function findById($id) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT *
                FROM rooms
                WHERE id = ?
            ");

            $stmt->execute([$id]);

            $room = $stmt->fetch(PDO::FETCH_ASSOC);

            return $room ?: null;

        } catch (PDOException $e) {
            return ['error' => 'database_error'];
        }
    }

    public function getAvailableRooms($start_time, $end_time, $type = null, $capacity = null, $name = null) {
        $query = "
            SELECT *
            FROM rooms r
            WHERE NOT EXISTS (
                SELECT 1
                FROM bookings b
                WHERE b.room_id = r.id
                AND b.status IN ('pending','approved')
                AND b.start_time < ?
                AND b.end_time > ?
            )
        ";

        $params = [$end_time, $start_time];

        if ($type !== null) {
            $query .= " AND r.type = ?";
            $params[] = $type;
        }

        if ($capacity !== null) {
            $query .= " AND r.capacity >= ?";
            $params[] = $capacity;
        }

        if ($name !== null && $name !== '') {
            $query .= " AND r.room_name LIKE ?";
            $params[] = '%' . $name . '%';
        }

        $query .= " ORDER BY r.id ASC";

        $stmt = $this->pdo->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function isAvailable($roomId, $startTime, $endTime) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) 
                FROM bookings
                WHERE room_id = ?
                AND status IN ('pending','approved')
                AND start_time < ?
                AND end_time > ?
            ");

            $stmt->execute([$roomId, $endTime, $startTime]);

            $count = $stmt->fetchColumn();

            return $count == 0;

        } catch (PDOException $e) {
            return null;
        }
    }

    public function getFeedback($roomId) {
        $stmt = $this->pdo->prepare("
            SELECT f.*, b.user_id, u.name as user_name
            FROM feedback f
            JOIN bookings b ON f.booking_id = b.id
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.room_id = ?
            ORDER BY f.id DESC
        ");

        $stmt->execute([$roomId]);

        return $stmt->fetchAll();
    }
}