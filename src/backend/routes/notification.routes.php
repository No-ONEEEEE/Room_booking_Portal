<?php
/**
 * ROOK - Notification Routes
 */

function registerNotificationRoutes($method, $path, $input, $query, $pdo) {
    $controller = new NotificationController($pdo);
    $userId = $_SESSION['user_id'] ?? null;

    if ($path === '/notifications' && $method === 'GET') {
        return $controller->getMyNotifications($userId);
    }

    if ($path === '/notifications/mark-all-read' && $method === 'PATCH') {
        return $controller->markAllAsRead($userId);
    }

    if (preg_match('#^/notifications/(\d+)/read$#', $path, $matches) && $method === 'PATCH') {
        return $controller->markAsRead($userId, $matches[1]);
    }

    if (preg_match('#^/notifications/(\d+)$#', $path, $matches) && $method === 'DELETE') {
        return $controller->delete($userId, $matches[1]);
    }

    return null;
}
