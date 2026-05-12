<?php
require_once __DIR__ . '/wq_db_connect.php';

// function to delete data from view_questions page
function delete_question() {
    global $conn;
    // Delete data when delete button is clicked from view_questions page
    if(isset($_GET["delete"])) {
        $id = (int) $_GET["delete"];
        $stmt = $conn->prepare("DELETE FROM countries WHERE id = ?");
        $stmt->bind_param("i", $id);
        if($stmt->execute()) {
            // redirect to view_questions page
            header("Location: view_questions.php");
        } else {
            // display error
            die("Error deleting record: ". $conn->error);
        }
    }
}

// function to delete data from view_users page
function delete_user() {
    global $conn;
    // Delete data when delete button is clicked from view_users page
    if (isset($_GET['delete'])) {
        $id = (int) $_GET['delete'];
        $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("i", $id);
        if($stmt->execute()) {
            // redirect to view_users page
            header("Location: view_users.php");
        } else {
            // display error
            die("Error deleting record: ". $conn->error);
        }
    }
}
