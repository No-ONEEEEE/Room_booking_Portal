<?php

function roomRoutes($method, $path, $input, $query, $pdo)
{

    $rooms = new RoomController($pdo);

    switch ($path) {

        case "/rooms":
            if ($method === "GET") {
                return $rooms->getRooms(
                    $query['type'] ?? null,
                    $query['capacity'] ?? null
                );
            }
            break;

        case "/rooms/available":
            if ($method === "GET") {
                return $rooms->getAvailableRooms(
                    $query['startTime'] ?? null,
                    $query['endTime'] ?? null,
                    $query['type'] ?? null,
                    $query['capacity'] ?? null,
                    $query['name'] ?? null
                );
            }
            break;
    }

    if ($method === "GET" && preg_match('#^/rooms/(\d+)/availability$#', $path, $matches)) {
        $roomId = (int) $matches[1];

        return $rooms->checkAvailability(
            $roomId,
            $query['startTime'] ?? null,
            $query['endTime'] ?? null
        );
    }

    if ($method === "GET" && preg_match("#^/rooms/(\d+)$#", $path, $matches)) {
        $roomId = (int) $matches[1];
        return $rooms->getById($roomId);
    }

    if ($method === "GET" && preg_match('#^/rooms/(\d+)/feedback$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError)
            return $authError;

        $roomId = (int) $matches[1];

        return $rooms->getFeedback($roomId);
    }

    if ($method === "GET" && preg_match('#^/rooms/(\d+)/bookings$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError)
            return $authError;

        $roomId = (int) $matches[1];
        return $rooms->getRoomBookings($roomId);
    }

    return null;
}