<?php
/**
 * ROOK - Notification Controller
 * Handles notification requests.
 */

class NotificationController {
    private $notificationModel;

    public function __construct($pdo) {
        $this->notificationModel = new Notification($pdo);
    }

    public function getMyNotifications($userId) {
        if (!$userId) {
            return error("User not authenticated", 401);
        }

        $notifications = $this->notificationModel->getUserNotifications($userId);
        return success("Notifications fetched", ["notifications" => $notifications]);
    }

    public function markAsRead($userId, $notificationId) {
        if (!$userId) {
            return error("User not authenticated", 401);
        }

        if (!$notificationId) {
            return error("Notification ID required", 400);
        }

        $this->notificationModel->markAsRead($notificationId, $userId);
        return success("Notification marked as read");
    }

    public function markAllAsRead($userId) {
        if (!$userId) {
            return error("User not authenticated", 401);
        }

        $this->notificationModel->markAllAsRead($userId);
        return success("All notifications marked as read");
    }

    public function delete($userId, $notificationId) {
        if (!$userId) {
            return error("User not authenticated", 401);
        }

        if (!$notificationId) {
            return error("Notification ID required", 400);
        }

        $this->notificationModel->delete($notificationId, $userId);
        return success("Notification deleted");
    }
}
