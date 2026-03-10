<?php

class FeedbackController {

    private $feedbackModel;

    public function __construct($pdo) {
        $this->feedbackModel = new Feedback($pdo);
    }

    public function create($bookingId, $rating, $comments = null) {
        if (!$bookingId || !$rating) {
            return error(
                "bookingId and rating are required",
                400,
                [
                    "bookingId" => !$bookingId ? "Booking id is required" : null,
                    "rating" => !$rating ? "Rating is required" : null
                ]
            );
        }

        if ($rating < 1 || $rating > 5) {
            return error(
                "Rating must be between 1 and 5",
                400,
                ["rating" => "Rating must be between 1 and 5"]
            );
        }

        $booking = $this->feedbackModel->getBooking($bookingId);

        if (!$booking) {
            return error("Booking not found", 404);
        }

        if ($booking['user_id'] != $_SESSION['user_id']) {
            return error("You can only leave feedback for your own bookings", 403);
        }

        if ($booking['status'] !== 'completed') {
            return error("Feedback can only be submitted for completed bookings", 409);
        }

        $existing = $this->feedbackModel->findByBookingId($bookingId);

        if ($existing) {
            return error(
                "Feedback already exists for this booking",
                409
            );
        }

        $feedbackId = $this->feedbackModel->create($bookingId, $rating, $comments);

        return success(
            "Feedback submitted",
            [
                "feedback" => [
                    "id" => $feedbackId
                ]
            ],
            201
        );
    }

    public function getByBookingId($bookingId) {
        if (!$bookingId) {
            return error(
                "Booking id required",
                400,
                ["bookingId" => "Booking id is required"]
            );
        }

        $feedback = $this->feedbackModel->findByBookingId($bookingId);

        if (!$feedback) {
            return error("Feedback not found", 404);
        }

        return success(
            "Feedback fetched",
            [
                "feedback" => $feedback
            ]
        );
    }

    public function getAll() {
        $feedbacks = $this->feedbackModel->getAll();

        return success(
            "Feedbacks fetched",
            [
                "feedbacks" => $feedbacks
            ]
        );
    }
}