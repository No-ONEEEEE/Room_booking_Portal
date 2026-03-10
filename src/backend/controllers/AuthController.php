<?php

class AuthController {
    private $userModel;

    public function __construct($pdo) {
        $this->userModel = new User($pdo);
    }

    public function login($email) {
        if (!$email) {
            return error(
                "Email is required",
                400,
                ["email" => "Email is required"]
            );
        }

        $user = $this->userModel->login($email);

        if (!$user) {
            return error(
                "User not found",
                404,
                ["email" => "No user exists with this email"]
            );
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = $user['role'];

        return success(
            "Login successful",
            [
                "user" => $user
            ]
        );
    }

    public function logout() {
        if (!isset($_SESSION['user_id'])) {
            return error("Not authenticated", 401);
        }

        session_unset();
        session_destroy();

        return success("Logged out successfully");
    }

    public function currentUser() {
        if (!isset($_SESSION['user_id'])) {
            return error("Not authenticated", 401);
        }

        $user = $this->userModel->findById($_SESSION['user_id']);

        if (!$user) {
            return error("User not found", 404);
        }

        return success(
            "Current user fetched",
            [
                "user" => $user
            ]
        );
    }
}