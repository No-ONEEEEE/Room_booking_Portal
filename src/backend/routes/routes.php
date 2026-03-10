<?php

require_once __DIR__ . '/auth.routes.php';
require_once __DIR__ . '/room.routes.php';
require_once __DIR__ . '/booking.routes.php';
require_once __DIR__ . '/feedback.routes.php';
require_once __DIR__ . '/user.routes.php';

function dispatch($method, $path, $input, $query, $pdo) {
    if ($method === "GET" && $path === "/health") {
        try {
            $pdo->query("SELECT 1");

            return success(
                "API healthy",
                [
                    "status" => "ok",
                    "database" => "connected",
                    "timestamp" => date('c')
                ]
            );

        } catch (Exception $e) {
            return error(
                "Database connection failed",
                500,
                [
                    "database" => "disconnected"
                ]
            );
        }
    }

    $routers = [
        'authRoutes',
        'roomRoutes',
        'bookingRoutes',
        'feedbackRoutes',
        'userRoutes'
    ];

    foreach ($routers as $router) {
        $response = $router($method, $path, $input, $query, $pdo);

        if ($response !== null) {
            return $response;
        }
    }

    return error("Route not found", 404);
}