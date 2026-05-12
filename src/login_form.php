<?php
session_start();
require_once 'includes/wq_db_connect.php';
require_once 'includes/csrf.php';

// checking for user inputs
if (isset($_POST["submit"])) {
    csrf_verify_form();
    $email    = $_POST["email"];
    $password = $_POST["password"];
    // query by email only — password is verified in PHP, not SQL
    $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row    = $result->fetch_assoc();
        $stored = $row["password"];
        // Migration: detect plaintext passwords (pre-hash era) and upgrade on login.
        // password_get_info returns algo=0 for non-PHP-hashed strings.
        $info = password_get_info($stored);
        if ($info['algo']) {
            $valid = password_verify($password, $stored);
        } else {
            $valid = ($password === $stored);
            if ($valid) {
                $new_hash = password_hash($password, PASSWORD_DEFAULT);
                $upd = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
                $upd->bind_param("si", $new_hash, $row["id"]);
                $upd->execute();
            }
        }

        if ($valid) {
            session_regenerate_id(true); // prevent session fixation
            if ($row["user_type"] == "admin") {
                $_SESSION["admin_name"] = $row["name"];
                $_SESSION["admin_id"]   = $row["id"];
                header("Location: admin_panel.php");
            } elseif ($row["user_type"] == "user") {
                $_SESSION["user_name"] = $row["name"];
                $_SESSION["user_id"]   = $row["id"];
                header("Location: user_panel.php");
            }
        } else {
            $error[] = "Invalid username or password!";
        }
    } else {
        $error[] = "Invalid username or password!";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorldQuiz – Login</title>
    <link rel="stylesheet" href="CSS/style.css?v=<?php echo @filemtime(__DIR__ . '/CSS/style.css'); ?>">
    <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">
</head>
<body class="landing">
<header>
    <a href="index.php" class="logo" style="text-decoration:none"><i class='bx bx-globe'></i>WorldQuiz.</a>
    <div class="nav-bar">
        <a href="index.php" class="landing-nav-link" style="text-decoration:none">
            <i class='bx bx-arrow-back'></i> Back to home
        </a>
    </div>
</header>

<div class="auth-split">
    <div class="auth-form-col">
        <div class="auth-eyebrow">Welcome back</div>
        <h1>Pick up where you <em>left off</em>.</h1>
        <p class="auth-sub">Your tokens, your level, and the question you were on — all waiting for you.</p>

        <form action="" method="POST" class="auth-form" novalidate>
            <input type="hidden" name="csrf_token" value="<?php echo csrf_token() ?>">

            <?php
            if (isset($error)) {
                foreach ($error as $err) {
                    echo "<p class='error-msg'>" . htmlspecialchars($err) . "</p>";
                }
            }
            ?>

            <label for="email">Email address</label>
            <input type="email" name="email" id="email" required placeholder="you@example.com" autocomplete="email">

            <label for="password">Password</label>
            <input type="password" name="password" id="password" required placeholder="Your password" autocomplete="current-password">

            <input type="submit" name="submit" value="Log in" class="form-btn">

            <p class="form-text">No account yet? <a href="create_account.php">Create one in 30 seconds</a></p>
        </form>
    </div>

    <div class="auth-image-col" aria-hidden="true">
        <img src="Images/Italy/q6-venice grand canal.jpg" alt="">
        <div class="auth-image-veil"></div>
        <div class="auth-image-caption">
            <div class="place">Grand Canal</div>
            <div class="country">Venice, Italy</div>
        </div>
    </div>
</div>

<?php require_once 'includes/footer.php'; ?>
</body>
</html>