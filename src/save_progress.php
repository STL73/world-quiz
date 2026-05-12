<?php
session_start();
header('Content-Type: application/json');
require_once 'includes/csrf.php';
csrf_verify_ajax();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['error' => 'Not authenticated.']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['questionId']) || !is_numeric($data['questionId'])) {
    echo json_encode(['error' => 'Invalid question ID.']);
    exit();
}

$_SESSION['current_question_id'] = (int) $data['questionId'];

echo json_encode(['ok' => true]);
