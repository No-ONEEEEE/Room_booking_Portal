<?php

function requireAdmin() {

    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        return response(403, false, "Admin access required");
    }

    return null;
}