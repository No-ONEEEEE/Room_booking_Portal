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

        // Redirect to CAS logout to clear CAS session
        $casLogoutUrl = "https://login.iiit.ac.in/cas/logout?service=" . urlencode("http://localhost:8000/src/frontend/index.html");
        header("Location: " . $casLogoutUrl);
        exit();
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

    public function redirectToCAS() {
        $service = urlencode("http://localhost:8000/src/backend/public/index.php/callback");

        $casUrl = "https://login.iiit.ac.in/cas/login?service=" . $service;

        header("Location: " . $casUrl);
        exit();
    }

    public function handleCASCallback($ticket) {
        if (!$ticket) {
            return error("Missing CAS ticket", 400);
        }

        $service = urlencode("http://localhost:8000/src/backend/public/index.php/callback");

        $validateUrl = "https://login.iiit.ac.in/cas/serviceValidate?service=$service&ticket=$ticket";

        $response = file_get_contents($validateUrl);

        if (!$response) {
            return error("CAS validation failed", 500);
        }

        $xml = simplexml_load_string($response);

        $namespaces = $xml->getNamespaces(true);
        $cas = $xml->children($namespaces['cas']);

        if (!isset($cas->authenticationSuccess)) {
            return error("Invalid CAS ticket", 401);
        }

        $auth = $cas->authenticationSuccess;

        $email = (string) $auth->user;

        $attrs = $auth->attributes->children($namespaces['cas']);
        $name = (string) $attrs->Name;

        $user = $this->userModel->findByEmail($email);

        if (!$user) {
            $user = $this->userModel->create($name, $email, 'user');
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = $user['role'];

        header("Location: /src/frontend/index.html");
        exit();
    }
}