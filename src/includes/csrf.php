<?php
// Generates (or returns the existing) CSRF token for the current session.
// session_start() must be called before using these functions.
function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

// Validates the CSRF token submitted with an HTML form via $_POST['csrf_token'].
function csrf_verify_form(): void {
    $submitted = $_POST['csrf_token'] ?? '';
    $expected  = $_SESSION['csrf_token'] ?? '';
    if (!$expected || !hash_equals($expected, $submitted)) {
        http_response_code(403);
        die('Request validation failed. Go back and try again.');
    }
}

// Validates the CSRF token sent by an AJAX request via the X-CSRF-Token header.
function csrf_verify_ajax(): void {
    $submitted = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected  = $_SESSION['csrf_token'] ?? '';
    if (!$expected || !hash_equals($expected, $submitted)) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid CSRF token.']);
        exit();
    }
}
