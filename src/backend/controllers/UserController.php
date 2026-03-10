<?php

class UserController {

    private $userModel;

    public function __construct($pdo) {
        $this->userModel = new User($pdo);
    }

    public function getAll() {
        $currentUserId = $_SESSION['user_id'] ?? null;

        $users = $this->userModel->getAll($currentUserId);

        return success(
            "Users fetched",
            [
                "users" => $users
            ]
        );
    }
}