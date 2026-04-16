<?php
/**
 * Router script for PHP built-in server (Moved to src/)
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$baseDir = dirname(__DIR__);

// 1. Serve static files if they exist
if (file_exists($baseDir . $uri) && !is_dir($baseDir . $uri)) {
    return false; // serve the requested resource as-is.
}

// 2. Route backend API calls to backend/public/index.php
if (strpos($uri, '/src/backend/public/') === 0) {
    $_SERVER['SCRIPT_NAME'] = '/src/backend/public/index.php';
    include $baseDir . '/src/backend/public/index.php';
    exit;
}

// 3. Handle the root redirect
if ($uri === '/' || $uri === '/src' || $uri === '/src/') {
    header("Location: /src/frontend/index.html");
    exit;
}

// 4. Fallback for other files (e.g. index.php in subdirs)
if (file_exists($baseDir . $uri . '/index.php')) {
    include $baseDir . $uri . '/index.php';
    exit;
}

return false;
