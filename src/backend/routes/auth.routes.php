<?php

require_once __DIR__ . '/../middleware/auth.middleware.php';

function authRoutes($method, $path, $input, $query, $pdo) {

    $auth = new AuthController($pdo);

    switch ($path) {

        case "/login":
            if ($method === "POST") {
                return $auth->login($input['email'] ?? null);
            }
            break;

        case "/logout":
            if ($method === "POST") {
                return $auth->logout();
            }
            break;

        case "/me":
            if ($method === "GET") {
                $authError = requireAuth();
                if ($authError) return $authError;
                return $auth->currentUser();
            }
            break;
    }

    return null;
}