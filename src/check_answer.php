<?php
session_start();
header('Content-Type: application/json');
require 'includes/wq_db_connect.php';
require_once 'includes/csrf.php';
csrf_verify_ajax();
// get data from user input on index page in json format
$data = json_decode(file_get_contents("php://input"), true);
// check if data is set
if (!isset($data['userId'], $data['currentQuestionId'], $data['answerIndex'])) {
    // if data is not set return error message
    echo json_encode(["error" => "Missing required parameters."]);
    exit();
}
// if data is set, assign variables to the received data
$user_id = $data['userId'];
$question_id = $data['currentQuestionId'];
$answer_index = (int) $data['answerIndex'];

// answer_index must be 1, 2, or 3 — reject anything else to prevent column-name injection
if (!in_array($answer_index, [1, 2, 3], true)) {
    echo json_encode(["error" => "Invalid answer index."]);
    exit();
}

// Checking in the database for the answer
$stmt = $conn->prepare("SELECT is_correct$answer_index FROM countries WHERE id = ?");
$stmt->bind_param("i", $question_id);
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();
// if no answer was found return error message
if (!$result) {
    echo json_encode(["error" => "Question ID not found."]);
    exit();
}
// if answer is found check if it is correct
$is_correct = $result["is_correct$answer_index"];
// set initial value for the score change to 0
$scoreChange = 0;


// Checking if the hint is used 
// set the value for hint_used to a session variable for current question id
$hint_used = isset($_SESSION['hint_used'][$question_id]) && $_SESSION['hint_used'][$question_id];

//  change the score variable based on hint usage and correctness
if ($is_correct) {
    $scoreChange = $hint_used ? 5 : 10; // +5 if hint used, +10 if not
} else {
    $scoreChange = 0;

}
// Update the score in the database
$updateScore = $conn->prepare("UPDATE score SET star_tokens = star_tokens + ?, level = floor(star_tokens/100)+1  WHERE id = ?");
$updateScore->bind_param("ii", $scoreChange, $user_id);
$updateScore->execute();

// Get the updated score
$scoreQuery = $conn->prepare("SELECT star_tokens, level FROM score WHERE id = ?");
$scoreQuery->bind_param("i", $user_id);
$scoreQuery->execute();
$scoreResult = $scoreQuery->get_result()->fetch_assoc();
$newTokens = $scoreResult['star_tokens'];
$newLevel = $scoreResult['level']; 

// Reset hint usage for the next question
unset($_SESSION['hint_used'][$question_id]);
// prepare the updated data in json format
echo json_encode(["newTokens" => $newTokens, "newLevel" => $newLevel, "isCorrect" => (bool)$is_correct, "scoreChange" => $scoreChange]);
$conn->close();



