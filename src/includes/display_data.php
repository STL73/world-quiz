<?php
require_once __DIR__ . '/wq_db_connect.php';

// function to display data on view_users page
function display_users() {
    global $conn;
    $stmt = $conn->prepare ("SELECT * FROM users");
    $stmt->execute();
    $result = $stmt->get_result();
    return $result;
}

// function to display data on view_questions page
function display_questions() {
    global $conn;
    $stmt = $conn->prepare("SELECT * FROM countries");
    $stmt->execute();
    $result = $stmt->get_result();
    return $result;
}

// function to display data on index page
function get_score() {
    global $conn;
    // using session variable to get the current user logged in
    $user_id = $_SESSION['user_id'];
    $stmt = $conn->prepare("SELECT * FROM score WHERE id =?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $score = $stmt->get_result()->fetch_assoc();
        return $score;

    }

    // function to display data on view_user_score page
    function user_score() {
        global $conn;
        $stmt = $conn->prepare('SELECT u.id, u.name, u.email, u.user_type, s.star_tokens, s.level FROM users u
        INNER JOIN score s ON u.id=s.id WHERE u.user_type="user";');
        $stmt->execute();
        $score = $stmt->get_result();
        return $score;
    }

    // fetch a single question row by ID for edit_question page
    function get_question_by_id($id) {
        global $conn;
        $stmt = $conn->prepare("SELECT * FROM countries WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row;
    }
