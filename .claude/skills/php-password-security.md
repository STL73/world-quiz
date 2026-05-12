# PHP Password & Session Security — WorldQuiz Reference

## Password hashing

WorldQuiz currently stores plaintext passwords. The correct approach:

### Registration (`create_account.php`)

```php
// WRONG — current code
$stmt->bind_param("ssss", $name, $email, $password, $user_type);

// CORRECT — hash before inserting
$hashed = password_hash($password, PASSWORD_BCRYPT);
$stmt->bind_param("ssss", $name, $email, $hashed, $user_type);
```

### Login (`login_form.php`)

```php
// WRONG — current code compares plaintext in SQL
$sel_sql = "SELECT * FROM users WHERE email = ? && password = ?";
$stmt->bind_param("ss", $email, $password);

// CORRECT — query by email only, then verify in PHP
$sel_sql = "SELECT * FROM users WHERE email = ?";
$stmt = $conn->prepare($sel_sql);
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $row = $result->fetch_assoc();
    if (password_verify($password, $row['password'])) {
        // login success — set session, regenerate ID
    } else {
        $error[] = "Invalid username or password!";
    }
}
```

## Session fixation fix

After a successful login, regenerate the session ID to prevent session fixation attacks:

```php
// Add this BEFORE setting session variables and redirecting
session_regenerate_id(true);

$_SESSION['user_name'] = $row['name'];
$_SESSION['user_id'] = $row['id'];
header("Location: user_panel.php");
exit();
```

Always call `exit()` after `header("Location: ...")` to stop script execution.

## Session guards

Every protected page must check the session at the very top, before any output:

```php
<?php
session_start();
if (!isset($_SESSION['user_name'])) {
    header("Location: login_form.php");
    exit();  // always exit after redirect
}
require_once("wq_db_connect.php");
// ... rest of page
```

Admin pages check `$_SESSION['admin_name']` instead.

## Logout (`logout.php`)

A complete, secure logout:

```php
<?php
session_start();
$_SESSION = [];                  // clear all session data
session_destroy();               // destroy the session
header("Location: login_form.php");
exit();
```

## Password minimum requirements

When validating registration input, add a minimum length check:

```php
if (strlen($password) < 8) {
    $error[] = "Password must be at least 8 characters.";
}
```
