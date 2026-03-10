<?php

require_once __DIR__ . '/../middleware/auth.middleware.php';

function userRoutes($method, $path, $input, $query, $pdo) {

    $user = new UserController($pdo);

    if ($method === "GET" && $path === "/users") {

        $authError = requireAuth();
        if ($authError) return $authError;

        return $user->getAll();
    }

    return null;
}