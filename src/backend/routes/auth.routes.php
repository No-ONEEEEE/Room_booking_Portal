<?php

require_once __DIR__ . '/../middleware/auth.middleware.php';

function authRoutes($method, $path, $input, $query, $pdo) {

    $auth = new AuthController($pdo);

    switch ($path) {

        case "/login":
            if ($method === "GET") {
                return $auth->redirectToCAS();
            }
            break;

        case "/callback":
            if ($method === "GET") {
                return $auth->handleCASCallback($query['ticket'] ?? null);
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

/*
TODO: Move GET /me endpoint to user.routes
*/