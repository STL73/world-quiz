<?php
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "wq_db";

$conn = new mysqli($servername, $username, $password, $dbname);
// if no connection display error
if ($conn->connect_error) {
    die("Connection failed: ".$conn->connect_error);
}
