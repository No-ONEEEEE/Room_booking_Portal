<?php
/**
 * ROOK - Notification Model
 * Manages notification data in the database.
 */

class Notification {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function create($userId, $bookingId, $message, $type = 'info') {
        $stmt = $this->pdo->prepare("
            INSERT INTO notifications (user_id, booking_id, message, type)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $bookingId, $message, $type]);
        return $this->pdo->lastInsertId();
    }

    public function getUserNotifications($userId, $limit = 20) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        ");
        $stmt->execute([$userId, (int)$limit]);
        return $stmt->fetchAll();
    }

    public function markAsRead($notificationId, $userId) {
        $stmt = $this->pdo->prepare("
            UPDATE notifications 
            SET is_read = TRUE 
            WHERE id = ? AND user_id = ?
        ");
        return $stmt->execute([$notificationId, $userId]);
    }

    public function markAllAsRead($userId) {
        $stmt = $this->pdo->prepare("
            UPDATE notifications 
            SET is_read = TRUE 
            WHERE user_id = ?
        ");
        return $stmt->execute([$userId]);
    }

    public function delete($notificationId, $userId) {
        $stmt = $this->pdo->prepare("
            DELETE FROM notifications 
            WHERE id = ? AND user_id = ?
        ");
        return $stmt->execute([$notificationId, $userId]);
    }
}
