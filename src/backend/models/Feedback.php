<?php

class Feedback {

    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function create($bookingId, $rating, $comments = null) {
        $stmt = $this->pdo->prepare("
            INSERT INTO feedback (booking_id, rating, comments)
            VALUES (?, ?, ?)
        ");

        $stmt->execute([
            $bookingId,
            $rating,
            $comments
        ]);

        return (int)$this->pdo->lastInsertId();
    }


    public function findByBookingId($bookingId) {
        $stmt = $this->pdo->prepare("
            SELECT f.*, b.room_id, b.user_id
            FROM feedback f
            JOIN bookings b ON f.booking_id = b.id
            WHERE f.booking_id = ?
        ");

        $stmt->execute([$bookingId]);

        $feedback = $stmt->fetch();

        return $feedback ?: null;
    }

    public function getBooking($bookingId) {
        $stmt = $this->pdo->prepare("
            SELECT id, user_id, status
            FROM bookings
            WHERE id = ?
        ");

        $stmt->execute([$bookingId]);

        $booking = $stmt->fetch();

        return $booking ?: null;
    }

    public function getAll() {
        $stmt = $this->pdo->prepare("
            SELECT f.*, 
                   b.user_id, b.room_id, b.start_time, b.end_time, b.purpose,
                   u.name AS user_name, u.email AS user_email,
                   r.room_name
            FROM feedback f
            JOIN bookings b ON f.booking_id = b.id
            JOIN users u ON b.user_id = u.id
            JOIN rooms r ON b.room_id = r.id
            ORDER BY f.id DESC
        ");

        $stmt->execute();

        return $stmt->fetchAll();
    }
}