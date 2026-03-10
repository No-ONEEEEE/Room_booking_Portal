<?php

require_once __DIR__ . '/../middleware/auth.middleware.php';
require_once __DIR__ . '/../middleware/admin.middleware.php';

function feedbackRoutes($method, $path, $input, $query, $pdo) {

    $feedback = new FeedbackController($pdo);
    
    if ($path === "/feedback" && $method === "POST") {
        $authError = requireAuth();
        if ($authError) return $authError;

        return $feedback->create(
            $input['bookingId'] ?? null,
            $input['rating'] ?? null,
            $input['comments'] ?? null
        );
    }

    if ($path === "/feedback" && $method === "GET") {
        $authError = requireAuth();
        if ($authError) return $authError;

        $adminError = requireAdmin();
        if ($adminError) return $adminError;

        // Check if bookingId is provided in query params
        if (isset($query['bookingId'])) {
            return $feedback->getByBookingId($query['bookingId']);
        }

        // Otherwise return all feedback
        return $feedback->getAll();
    }

    return null;
}

/*
TODO: POST /feedback => Pass bookingId as a path parameter instead of in the body 
TODO: GET /feedback => Remove
*/