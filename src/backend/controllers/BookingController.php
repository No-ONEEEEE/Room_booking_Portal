<?php

require_once __DIR__ . '/../utils/email.php';

class BookingController
{
    private $bookingModel;
    private $roomModel;
    private $userModel;
    private $notificationModel;

    public function __construct($pdo)
    {
        $this->bookingModel = new Booking($pdo);
        $this->roomModel = new Room($pdo);
        $this->userModel = new User($pdo);
        $this->notificationModel = new Notification($pdo);
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

        if (!$userId || !$roomId || !$startTime || !$endTime || !$purpose || !$expectedPeople) {
            return error(
                "Missing required booking fields",
                400,
                [
                    "userId" => !$userId ? "User id is required" : null,
                    "roomId" => !$roomId ? "Room id is required" : null,
                    "startTime" => !$startTime ? "Start time is required" : null,
                    "endTime" => !$endTime ? "End time is required" : null,
                    "purpose" => !$purpose ? "Purpose is required" : null,
                    "expectedPeople" => !$expectedPeople ? "Expected people is required" : null
                ]
            );
        }

        if (!is_array($guests)) {
            return error(
                "Guests must be an array",
                400,
                ["guests" => "Invalid guest list format"]
            );
        }

        $room = $this->roomModel->findById($roomId);

        if (!$room) {
            return error(
                "Room not found",
                404,
                ["roomId" => "Room does not exist"]
            );
        }

        if ($expectedPeople <= 0) {
            return error(
                "Expected people must be greater than zero",
                400,
                ["expectedPeople" => "Invalid expected people count"]
            );
        }

        if ($expectedPeople > $room['capacity']) {
            return error(
                "Expected people exceeds room capacity",
                400,
                ["expectedPeople" => "Room capacity exceeded"]
            );
        }

        $start = strtotime($startTime);
        $end = strtotime($endTime);

        if (!$start || !$end) {
            return error("Invalid time format", 400);
        }

        if ($end <= $start) {
            return error("End time must be after start time", 400);
        }

        $startTime = date('Y-m-d H:i:s', $start);
        $endTime = date('Y-m-d H:i:s', $end);

        $result = $this->bookingModel->create(
            $userId,
            $roomId,
            $startTime,
            $endTime,
            $purpose,
            $expectedPeople,
            $snacksRequested,
            $refreshmentDetails,
            $remarks,
            $guests
        );

        if (isset($result['error'])) {

            switch ($result['error']) {

                case 'missing_fields':
                    return error("Missing required booking fields", 400);

                case 'empty_purpose':
                    return error("Purpose cannot be empty", 400);

                case 'purpose_too_long':
                    return error("Purpose exceeds maximum allowed length", 400);

                case 'invalid_guest':
                    return error(
                        "One or more guest users do not exist",
                        400,
                        ["guests" => "Invalid guest IDs"]
                    );

                case 'conflict':
                    return error("Booking conflict detected", 409);

                default:
                    return error("Invalid booking request", 400);
            }
        }

        if (isset($result['booking_id'])) {
            $bookingId = $result['booking_id'];
            $admins = $this->userModel->getAdmins();
            $roomName = $room['room_name'] ?? 'Room ' . $roomId;

            // Get full booking details
            $bookingDetails = $this->bookingModel->findById($bookingId);
            foreach ($admins as $admin) {
                $this->notificationModel->create(
                    $admin['id'],
                    $bookingId,
                    "New booking request received for $roomName.",
                    'info'
                );
                
                // Send email to admin about new booking request
                if (isset($admin['email']) && isset($admin['name'])) {
                    sendBookingRequestEmailToAdmin(
                        $admin['email'],
                        $admin['name'],
                        $bookingDetails,
                        ['name' => $bookingDetails['user_name'], 'email' => $bookingDetails['user_email']]
                    );
                }
            }
            
            // Send email to CDS if refreshments are requested
            if ($snacksRequested && $bookingDetails) {
                $config = require __DIR__ . '/../config/mail.php';
                if (isset($config['cds_email']) && !empty($config['cds_email'])) {
                    sendRefreshmentRequestEmailToCDS(
                        $config['cds_email'],
                        $bookingDetails,
                        ['name' => $bookingDetails['user_name'], 'email' => $bookingDetails['user_email']]
                    );
                }
            }
        }

        return success(
            "Booking created",
            [
                "booking" => [
                    "id" => $result['booking_id']
                ]
            ],
            201
        );
    }

    public function getById($bookingId)
    {
        if (!$bookingId) {
            return error(
                "Booking id required",
                400,
                ["bookingId" => "Booking id is required"]
            );
        }

        $booking = $this->bookingModel->findById($bookingId);

        if (!$booking) {
            return error("Booking not found", 404);
        }

        return success(
            "Booking fetched",
            [
                "booking" => $booking
            ]
        );
    }

    public function cancel($bookingId, $userId)
    {
        if (!$bookingId || !$userId) {
            return error("Booking id and user id required", 400);
        }

        $booking = $this->bookingModel->findById($bookingId);

        if (!$booking) {
            return error("Booking not found", 404);
        }

        if ($booking['user_id'] != $userId) {
            return error("You cannot cancel someone else's booking", 403);
        }

        if (!in_array($booking['status'], ['pending', 'approved'])) {
            return error("Booking cannot be cancelled", 409);
        }

        if (strtotime($booking['start_time']) <= time()) {
            return error("Booking already started and cannot be cancelled", 409);
        }

        $this->bookingModel->cancel($bookingId);

        return success("Booking cancelled");
    }

    public function update(
        $bookingId,
        $userId,
        $startTime = null,
        $endTime = null,
        $purpose = null,
        $expectedPeople = null,
        $snacksRequested = null,
        $refreshmentDetails = null,
        $remarks = null,
        $guests = null
    ) {

        if (!$bookingId || !$userId) {
            return error("Booking id and user id required", 400);
        }

        $booking = $this->bookingModel->findById($bookingId);

        if (!$booking) {
            return error("Booking not found", 404);
        }

        if ($booking['user_id'] != $userId) {
            return error("You cannot update someone else's booking", 403);
        }

        if (!in_array($booking['status'], ['pending', 'approved'])) {
            return error(
                "Only pending or approved bookings can be updated",
                409
            );
        }

        $room = $this->roomModel->findById($booking['room_id']);

        $start = $startTime ? strtotime($startTime) : strtotime($booking['start_time']);
        $end = $endTime ? strtotime($endTime) : strtotime($booking['end_time']);

        if (!$start || !$end) {
            return error("Invalid time format", 400);
        }

        if ($end <= $start) {
            return error("End time must be after start time", 400);
        }

        if ($expectedPeople !== null) {

            if ($expectedPeople <= 0) {
                return error(
                    "Expected people must be greater than zero",
                    400,
                    ["expectedPeople" => "Invalid expected people count"]
                );
            }

            if ($expectedPeople > $room['capacity']) {
                return error(
                    "Expected people exceeds room capacity",
                    400,
                    ["expectedPeople" => "Room capacity exceeded"]
                );
            }
        }

        if ($guests !== null) {

            if (!is_array($guests)) {
                return error(
                    "Guests must be an array",
                    400,
                    ["guests" => "Invalid guest format"]
                );
            }

            if (in_array($userId, $guests)) {
                return error(
                    "Booking owner cannot be added as guest",
                    400
                );
            }

            if ($expectedPeople !== null && count($guests) > $expectedPeople) {
                return error(
                    "Guest count cannot exceed expected people",
                    400
                );
            }
        }

        $startTime = date('Y-m-d H:i:s', $start);
        $endTime = date('Y-m-d H:i:s', $end);

        $result = $this->bookingModel->update(
            $bookingId,
            $booking['room_id'],
            $startTime,
            $endTime,
            $purpose,
            $expectedPeople,
            $snacksRequested,
            $refreshmentDetails,
            $remarks,
            $guests
        );

        if ($result === null) {
            return error("Booking not found", 404);
        }

        if ($result === false) {
            return error("Booking conflict detected", 409);
        }

        return success("Booking updated");
    }

    public function markCompleted($bookingId)
    {
        if (!$bookingId) {
            return error(
                "Booking id required",
                400,
                ["bookingId" => "Booking id is required"]
            );
        }

        $updated = $this->bookingModel->markCompleted($bookingId);

        if (!$updated) {
            return error("Booking cannot be marked completed", 409);
        }

        $booking = $this->bookingModel->findById($bookingId);
        if ($booking) {
            $this->notificationModel->create(
                $booking['user_id'],
                $bookingId,
                "Your booking for room " . ($booking['room_name'] ?? $booking['room_id']) . " has been marked as completed.",
                'info'
            );
        }

        return success("Booking marked completed");
    }

    public function approve($bookingId)
    {
        if (!$bookingId) {
            return error(
                "Booking id required",
                400,
                ["bookingId" => "Booking id is required"]
            );
        }

        $approved = $this->bookingModel->approve($bookingId);

        if ($approved === null) {
            return error("Booking not found", 404);
        }

        if ($approved === false) {
            return error(
                "Booking cannot be approved",
                409,
                ["booking" => "Conflict or invalid booking state"]
            );
        }

        //added Sending approval email
        $booking = $this->bookingModel->findById($bookingId);
        if ($booking && isset($booking['user_email']) && isset($booking['user_name'])) {
            sendBookingApprovalEmail($booking['user_email'], $booking['user_name'], $booking);

            // Notification
            $this->notificationModel->create(
                $booking['user_id'],
                $bookingId,
                "Your booking for room " . ($booking['room_name'] ?? $booking['room_id']) . " has been approved.",
                'success'
            );
        }

        return success("Booking approved");
    }

    public function decline($bookingId, $reason)
    {
        if (!$reason) {
            return error(
                "Decline reason required",
                400,
                ["reason" => "Decline reason is required"]
            );
        }

        $declined = $this->bookingModel->decline($bookingId, $reason);

        if ($declined === null) {
            return error("Booking not found", 404);
        }

        if ($declined === false) {
            return error("Booking cannot be declined", 409);
        }

        //added Sending rejection email
        $booking = $this->bookingModel->findById($bookingId);
        if ($booking && isset($booking['user_email']) && isset($booking['user_name'])) {
            sendBookingRejectionEmail($booking['user_email'], $booking['user_name'], $booking, $reason);

            // Notification
            $this->notificationModel->create(
                $booking['user_id'],
                $bookingId,
                "Your booking for room " . ($booking['room_name'] ?? $booking['room_id']) . " was declined. Reason: " . $reason,
                'error'
            );
        }

        return success("Booking declined");
    }

    public function requestMoreDetails($bookingId, $notes)
    {
        if (!$notes) {
            return error(
                "Clarification notes required",
                400,
                ["notes" => "Clarification notes are required"]
            );
        }

        $updated = $this->bookingModel->requestMoreDetails($bookingId, $notes);

        if ($updated === null) {
            return error("Booking not found", 404);
        }

        if ($updated === false) {
            return error("Unable to request more details", 409);
        }

        if ($updated) {
            $booking = $this->bookingModel->findById($bookingId);
            if ($booking) {
                $this->notificationModel->create(
                    $booking['user_id'],
                    $bookingId,
                    "Additional details have been requested for your booking.",
                    'info'
                );
            }
        }

        return success("Clarification requested from user");
    }

    public function filter($startDate = null, $endDate = null, $status = null, $roomId = null, $userId = null)
    {
        if ($startDate !== null && !$this->isValidDate($startDate)) {
            return error("Invalid start date format", 400);
        }

        if ($endDate !== null && !$this->isValidDate($endDate)) {
            return error("Invalid end date format", 400);
        }

        $validStatuses = ['pending', 'approved', 'declined', 'cancelled', 'completed'];

        if ($status !== null && !in_array($status, $validStatuses)) {
            return error("Invalid status filter", 400);
        }

        $bookings = $this->bookingModel->getBookingsForFilter(
            $startDate,
            $endDate,
            $status,
            $roomId,
            $userId
        );

        return success(
            "Filtered bookings fetched",
            [
                "bookings" => $bookings
            ]
        );
    }

    public function statistics($startDate = null, $endDate = null, $status = null, $roomId = null)
    {
        if ($startDate !== null && !$this->isValidDate($startDate)) {
            return error("Invalid start date format", 400);
        }

        if ($endDate !== null && !$this->isValidDate($endDate)) {
            return error("Invalid end date format", 400);
        }

        $stats = $this->bookingModel->getStatistics(
            $startDate,
            $endDate,
            $status,
            $roomId
        );

        return success(
            "Booking statistics fetched",
            [
                "statistics" => $stats
            ]
        );
    }

    private function isValidDate($date)
    {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
}