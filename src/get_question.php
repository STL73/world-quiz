<?php
require_once 'includes/wq_db_connect.php';
// check if the question id is already loaded and return integer value of 1 if found or 0 if not
$current_id = isset($_GET["id"]) ? intval($_GET["id"]) : 0;
// check the value of the current question id
if ($current_id == 0) {
    // if the value is 0, fetch the first question
    $stmt = $conn->prepare("SELECT * FROM countries ORDER BY id ASC LIMIT 1");
} else {
    // if the value is 1, fetch the next question
    $stmt = $conn->prepare("SELECT * FROM countries WHERE id > ? ORDER BY id ASC LIMIT 1");
    $stmt->bind_param("i", $current_id);
}
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();

// send the data in json format
header('Content-Type: application/json');
echo json_encode($result);

$conn->close();


