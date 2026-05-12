<?php
require_once 'includes/wq_db_connect.php';
// file to logout from the app
session_start();
session_unset();
session_destroy();
// redirect to login page
header('Location: login_form.php');

