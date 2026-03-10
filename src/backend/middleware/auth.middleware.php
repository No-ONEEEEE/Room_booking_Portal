<?php

function requireAuth() {

    if (!isset($_SESSION['user_id'])) {
        return response(401, false, "Authentication required");
    }

    return null;
}