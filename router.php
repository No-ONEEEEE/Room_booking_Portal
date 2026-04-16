<?php
/**
 * Router script for PHP built-in server
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 1. Serve static files if they exist
if (file_exists(__DIR__ . $uri) && !is_dir(__DIR__ . $uri)) {
    return false; // serve the requested resource as-is.
}

// 2. Route backend API calls to backend/public/index.php
// Example: /backend/public/login -> backend/public/index.php
if (strpos($uri, '/src/backend/public/') === 0) {
    $_SERVER['SCRIPT_NAME'] = '/src/backend/public/index.php';
    include __DIR__ . '/src/backend/public/index.php';
    exit;
}

// 3. Handle the root redirect
if ($uri === '/' || $uri === '/src' || $uri === '/src/') {
    header("Location: /src/frontend/index.html");
    exit;
}

// 4. Fallback for other files (e.g. index.php in subdirs)
if (file_exists(__DIR__ . $uri . '/index.php')) {
    include __DIR__ . $uri . '/index.php';
    exit;
}

return false;
