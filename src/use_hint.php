<?php
session_start();
header('Content-Type: application/json');
require 'includes/wq_db_connect.php';
require_once 'includes/csrf.php';
csrf_verify_ajax();
// get data from user input on index page in json format
$data = json_decode(file_get_contents("php://input"), true);
// check if data is set
if (!isset($data['userId'], $data['currentQuestionId'])) {
    // if data is not set return error message
    echo json_encode(["error" => "Missing userId or currentQuestionId parameter."]);
    exit();
}
// if data is set, assign variables to the received data
$user_id = $data['userId'];
$question_id = $data['currentQuestionId'];

// check session variable for the hint exists
if (!isset($_SESSION['hint_used'])) {
    // if not exists, set the initial value to empty string
    $_SESSION['hint_used'] = [];
}

// Reset hint usage if a new question is loaded using the session variable for the current question id
if (!isset($_SESSION['current_question_id']) || $_SESSION['current_question_id'] != $question_id) {
    $_SESSION['hint_used'] = [];
    $_SESSION['current_question_id'] = $question_id;
}

// check if the hint is used to prevent multiple hint usage on the same question
if (isset($_SESSION['hint_used'][$question_id])) {
    // if hint is used, return error message
    echo json_encode(["error" => "Hint already used for this question."]);
    exit();
}

// if the hint is not used get the hint for the current question
$stmt = $conn->prepare("SELECT hint FROM countries WHERE id = ?");
$stmt->bind_param("i", $question_id);
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();
// if no result display error message
if (!$result) {
    echo json_encode(["error" => "Hint not found for this question."]);
    exit();
}
// if there is a result, assign data to hint_message variable
$hint_message = $result["hint"];

// Marking that hint is used
$_SESSION['hint_used'][$question_id] = true;

// get the updated star tokens to be correctly displayed to the user
$scoreQuery = $conn->prepare("SELECT star_tokens FROM score WHERE id = ?");
$scoreQuery->bind_param("i", $user_id);
$scoreQuery->execute();
$scoreResult = $scoreQuery->get_result()->fetch_assoc();
$newTokens = $scoreResult['star_tokens'];
// prepare the data in json format
echo json_encode(["newTokens" => $newTokens, "hint" => $hint_message]);

$conn->close();












