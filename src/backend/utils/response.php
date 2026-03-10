<?php

function response($code, $success, $message = null, $data = null, $errors = null) {
    $res = [
        "code" => $code,
        "success" => $success
    ];

    if ($message !== null) {
        $res["message"] = $message;
    }

    if ($data !== null) {
        $res["data"] = $data;
    }

    if ($errors !== null) {
        $res["errors"] = $errors;
    }

    return $res;
}

function success($message = null, $data = null, $code = 200) {
    return response($code, true, $message, $data);
}

function error($message = null, $code = 400, $errors = null) {
    return response($code, false, $message, null, $errors);
}