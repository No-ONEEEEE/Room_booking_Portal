<?php

require_once __DIR__ . '/../middleware/auth.middleware.php';
require_once __DIR__ . '/../middleware/admin.middleware.php';

function bookingRoutes($method, $path, $input, $query, $pdo) {

    $booking = new BookingController($pdo);

    switch ($path) {

        case "/bookings":
            $authError = requireAuth();
            if ($authError) return $authError;

            if ($method === "POST") {

                return $booking->create(
                    $_SESSION['user_id'] ?? null,
                    $input['roomId'] ?? null,
                    $input['startTime'] ?? null,
                    $input['endTime'] ?? null,
                    $input['purpose'] ?? null,
                    $input['expectedPeople'] ?? null,
                    $input['snacksRequested'] ?? false,
                    $input['refreshmentDetails'] ?? null,
                    $input['remarks'] ?? null,
                    $input['guests'] ?? []
                );

            } elseif ($method === "GET") {

                $userId = $_SESSION['user_id'] ?? null;
                $isAdmin = ($_SESSION['role'] ?? null) === 'admin';

                $userFilter = $isAdmin ? ($query['userId'] ?? null) : $userId;

                return $booking->filter(
                    $query['startDate'] ?? null,
                    $query['endDate'] ?? null,
                    $query['status'] ?? null,
                    $query['roomId'] ?? null,
                    $userFilter
                );
            }

            break;

        case "/bookings/statistics":
            if ($method === "GET") {

                $authError = requireAuth();
                if ($authError) return $authError;

                $adminError = requireAdmin();
                if ($adminError) return $adminError;

                return $booking->statistics(
                    $query['startDate'] ?? null,
                    $query['endDate'] ?? null,
                    $query['status'] ?? null,
                    $query['roomId'] ?? null
                );
            }

            break;
    }

    if ($method === "PATCH" && preg_match('#^/bookings/(\d+)/cancel$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError) return $authError;

        $bookingId = (int)$matches[1];

        return $booking->cancel(
            $bookingId,
            $_SESSION['user_id'] ?? null
        );
    }

    if ($method === "PATCH" && preg_match('#^/bookings/(\d+)/complete$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError) return $authError;

        $adminError = requireAdmin();
        if ($adminError) return $adminError;

        $bookingId = (int)$matches[1];

        return $booking->markCompleted($bookingId);
    }

    if ($method === "PATCH" && preg_match('#^/bookings/(\d+)/approve$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError) return $authError;

        $adminError = requireAdmin();
        if ($adminError) return $adminError;

        return $booking->approve((int)$matches[1]);
    }

    if ($method === "PATCH" && preg_match('#^/bookings/(\d+)/decline$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError) return $authError;

        $adminError = requireAdmin();
        if ($adminError) return $adminError;

        return $booking->decline(
            (int)$matches[1],
            $input['reason'] ?? null
        );
    }

    if ($method === "PATCH" && preg_match('#^/bookings/(\d+)/request-details$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError) return $authError;

        $adminError = requireAdmin();
        if ($adminError) return $adminError;

        return $booking->requestMoreDetails(
            (int)$matches[1],
            $input['notes'] ?? null
        );
    }

    if ($method === "POST" && preg_match('#^/bookings/(\d+)/provide-details$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError) return $authError;

        return $booking->provideClarification(
            (int)$matches[1],
            $input['response'] ?? null
        );
    }

    if ($method === "GET" && preg_match("#^/bookings/(\d+)$#", $path, $matches)) {

        $authError = requireAuth();
        if ($authError) return $authError;

        $bookingId = (int)$matches[1];

        return $booking->getById($bookingId);
    }

    if ($method === "PATCH" && preg_match('#^/bookings/(\d+)$#', $path, $matches)) {
        $authError = requireAuth();
        if ($authError) return $authError;

        $bookingId = (int)$matches[1];

        return $booking->update(
            $bookingId,
            $_SESSION['user_id'] ?? null,
            $input['startTime'] ?? null,
            $input['endTime'] ?? null,
            $input['purpose'] ?? null,
            $input['expectedPeople'] ?? null,
            $input['snacksRequested'] ?? null,
            $input['refreshmentDetails'] ?? null,
            $input['remarks'] ?? null,
            $input['guests'] ?? null
        );
    }

    return null;
}