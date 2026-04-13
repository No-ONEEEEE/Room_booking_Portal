<?php

session_start();

require_once __DIR__ . '/../database/connection.php';
require_once __DIR__ . '/../utils/response.php';

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Room.php';
require_once __DIR__ . '/../models/Booking.php';
require_once __DIR__ . '/../models/Feedback.php';
require_once __DIR__ . '/../models/Notification.php';

require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/RoomController.php';
require_once __DIR__ . '/../controllers/BookingController.php';
require_once __DIR__ . '/../controllers/FeedbackController.php';
require_once __DIR__ . '/../controllers/UserController.php';
require_once __DIR__ . '/../controllers/NotificationController.php';

require_once __DIR__ . '/../routes/routes.php';

header('Content-Type: application/json');

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

    $path = str_replace(dirname($_SERVER['SCRIPT_NAME']), '', $path);
    $path = str_replace('/index.php', '', $path);

    if ($path === '') {
        $path = '/';
    }

    $rawBody = file_get_contents('php://input');
    $input = $rawBody ? json_decode($rawBody, true) : [];

    if ($rawBody && json_last_error() !== JSON_ERROR_NONE) {
        $response = error("Invalid JSON body", 400);
    } else {

        $query = $_GET;

        $response = dispatch($method, $path, $input, $query, $pdo);
    }

} catch (Throwable $e) {
    $response = error("Internal server error", 500);
}

http_response_code($response['code']);
unset($response['code']);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);