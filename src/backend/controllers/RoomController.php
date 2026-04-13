<?php

class RoomController
{
    private $roomModel;
    private $bookingModel;

    public function __construct($pdo)
    {
        $this->roomModel = new Room($pdo);
        $this->bookingModel = new Booking($pdo);
    }

    public function getRooms($type = null, $capacity = null)
    {
        $rooms = $this->roomModel->getRooms($type, $capacity);

        if (isset($rooms['error'])) {
            if ($rooms['error'] === 'invalid_type') {
                return error(
                    "Invalid room type",
                    400,
                    ["type" => "Allowed values: classroom, meeting"]
                );
            }

            if ($rooms['error'] === 'invalid_capacity') {
                return error(
                    "Invalid capacity value",
                    400,
                    ["capacity" => "Capacity must be a positive number"]
                );
            }

            if ($rooms['error'] === 'database_error') {
                return error("Internal server error", 500);
            }
        }

        return success(
            "Rooms fetched",
            [
                "rooms" => $rooms
            ]
        );
    }

    public function getById($id)
    {
        if ($id === null) {
            return error(
                "Room id is required",
                400,
                ["roomId" => "Room id is required"]
            );
        }

        if (!is_numeric($id) || $id <= 0) {
            return error(
                "Invalid room id",
                400,
                ["roomId" => "Room id must be a positive integer"]
            );
        }

        $room = $this->roomModel->findById($id);

        if (is_array($room) && isset($room['error']) && $room['error'] === 'database_error') {
            return error("Internal server error", 500);
        }

        if (!$room) {
            return error("Room not found", 404);
        }

        return success(
            "Room fetched",
            [
                "room" => $room
            ]
        );
    }

    public function checkAvailability($roomId, $startTime, $endTime)
    {
        if (!$roomId || !$startTime || !$endTime) {
            return error(
                "roomId, startTime and endTime are required",
                400,
                [
                    "roomId" => !$roomId ? "Room id is required" : null,
                    "startTime" => !$startTime ? "Start time is required" : null,
                    "endTime" => !$endTime ? "End time is required" : null
                ]
            );
        }

        if ($roomId <= 0) {
            return error(
                "Invalid room id",
                400,
                ["roomId" => "Room id must be a positive integer"]
            );
        }

        $start = strtotime($startTime);
        $end = strtotime($endTime);

        if (!$start || !$end) {
            return error(
                "Invalid time format",
                400,
                ["time" => "Time must be a valid ISO datetime"]
            );
        }

        if ($end <= $start) {
            return error(
                "Invalid time range",
                400,
                ["endTime" => "End time must be after start time"]
            );
        }

        $startTime = date('Y-m-d H:i:s', $start);
        $endTime = date('Y-m-d H:i:s', $end);

        $room = $this->roomModel->findById($roomId);

        if (!$room) {
            return error("Room not found", 404);
        }

        $available = $this->roomModel->isAvailable($roomId, $startTime, $endTime);

        if ($available === null) {
            return error("Internal server error", 500);
        }

        return success(
            "Availability checked",
            [
                "availability" => [
                    "roomId" => $roomId,
                    "available" => $available
                ]
            ]
        );
    }

    public function getAvailableRooms($startTime, $endTime, $type = null, $capacity = null)
    {
        if (!$startTime || !$endTime) {
            return error(
                "startTime and endTime are required",
                400,
                [
                    "startTime" => !$startTime ? "Start time is required" : null,
                    "endTime" => !$endTime ? "End time is required" : null
                ]
            );
        }

        $start = strtotime($startTime);
        $end = strtotime($endTime);

        if (!$start || !$end) {
            return error(
                "Invalid time format",
                400,
                ["time" => "Invalid time format provided"]
            );
        }

        if ($end <= $start) {
            return error(
                "Invalid time range",
                400,
                ["endTime" => "End time must be after start time"]
            );
        }

        $validTypes = ['classroom', 'meeting'];

        if ($type !== null && !in_array($type, $validTypes)) {
            return error(
                "Invalid room type",
                400,
                ["type" => "Allowed values: classroom, meeting"]
            );
        }

        if ($capacity !== null && (!ctype_digit((string) $capacity) || $capacity < 1)) {
            return error(
                "Invalid capacity value",
                400,
                ["capacity" => "Capacity must be a positive integer"]
            );
        }

        $startTime = date('Y-m-d H:i:s', $start);
        $endTime = date('Y-m-d H:i:s', $end);

        $rooms = $this->roomModel->getAvailableRooms($startTime, $endTime, $type, $capacity);

        return success(
            "Available rooms fetched",
            [
                "rooms" => $rooms
            ]
        );
    }

    public function getFeedback($roomId)
    {
        if (!$roomId) {
            return error(
                "Room id is required",
                400,
                ["roomId" => "Room id is required"]
            );
        }

        $room = $this->roomModel->findById($roomId);

        if (!$room) {
            return error("Room not found", 404);
        }

        $feedback = $this->roomModel->getFeedback($roomId);

        return success(
            "Room feedback fetched",
            [
                "feedback" => $feedback
            ]
        );
    }
    public function getRoomBookings($roomId)
    {
        if (!$roomId) {
            return error("Room id is required", 400);
        }

        $room = $this->roomModel->findById($roomId);
        if (!$room) {
            return error("Room not found", 404);
        }

        // Fetch bookings for the room (all statuses that matter for occupancy)
        // We probably only want approved and pending bookings?
        // Let's get all and let the frontend filter if needed, 
        // or just return approved/pending as "occupied".
        $bookings = $this->bookingModel->getBookingsForFilter(null, null, null, $roomId);

        return success(
            "Room bookings fetched",
            [
                "bookings" => $bookings
            ]
        );
    }
}