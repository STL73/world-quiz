<?php
session_start();
require_once 'includes/wq_db_connect.php';
require_once 'includes/csrf.php';
// checking for user inputs and assigning variables
if (isset($_POST["submit"])) {
    csrf_verify_form();
    $name = $_POST["name"];
    $email = $_POST["email"];
    $password = $_POST["password"];
    $conf_password = $_POST["conf_password"];
    $user_type = "user"; // Role is always user; admins must be set directly in the database

    // querying the database data based on email 
    $sel_sql = "SELECT * FROM users WHERE email = ?";
    $stmt = $conn->prepare($sel_sql);
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
// check if email already exists
    if ($result->num_rows > 0) {
        // if email already exists then display error
        $error[] = "Email already exists. Please try again.";
    } else {
        // Validate both password and confirm password for matching
        if ($password != $conf_password) {
            // if passwords do not match then display error
            $error[] = "Passwords do not match. Please try again.";
        } elseif (empty($name) || empty($email) || empty($password) || empty($conf_password)) { // checking for empty inputs
            // if any field is empty then display error
            $error[] = "All fields are required. Please try again.";

        }
        else {
            // if the user not exists, then preparing statement and insert new user
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $ins_sql = "INSERT INTO users (name, email, password, user_type) VALUES (?, ?, ?, ?)";
            $stmt = $conn->prepare($ins_sql);
            $stmt->bind_param("ssss", $name, $email, $hashed_password, $user_type);
            $stmt->execute();
            $user_id = $stmt->insert_id; // Get the newly created user ID

            // preparing statement and insert default score
            $score_sql = "INSERT INTO score (id, star_tokens, level) VALUES (?, 10, 1)";
            $stmt2 = $conn->prepare($score_sql);
            $stmt2->bind_param("i", $user_id);
            $stmt2->execute();
            
            // Redirect to login page after successful registration
            header("Location: login_form.php");
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorldQuiz – Create Account</title>
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
    <div class="auth-image-col" aria-hidden="true">
        <img src="Images/Egypt/q1-the great pyramids.jpg" alt="">
        <div class="auth-image-veil"></div>
        <div class="auth-image-caption">
            <div class="place">Great Pyramids of Giza</div>
            <div class="country">Cairo, Egypt</div>
        </div>
    </div>

    <div class="auth-form-col">
        <div class="auth-eyebrow">Start playing</div>
        <h1>Create your account <em>in seconds</em>.</h1>
        <p class="auth-sub">Free forever. No card. Your first ten star tokens are on the house.</p>

        <form action="" method="POST" class="auth-form" novalidate>
            <input type="hidden" name="csrf_token" value="<?php echo csrf_token() ?>">

            <?php
            if (isset($error)) {
                foreach ($error as $err) {
                    echo "<p class='error-msg'>" . htmlspecialchars($err) . "</p>";
                }
            }
            ?>

            <label for="name">Full name</label>
            <input type="text" name="name" id="name" required placeholder="Slav Lambov" autocomplete="name">

            <label for="email">Email address</label>
            <input type="email" name="email" id="email" required placeholder="you@example.com" autocomplete="email">

            <label for="password">Password</label>
            <input type="password" name="password" id="password" required placeholder="Make it a good one" autocomplete="new-password">

            <label for="conf_password">Confirm password</label>
            <input type="password" name="conf_password" id="conf_password" required placeholder="Once more" autocomplete="new-password">

            <input type="hidden" name="user_type" value="user">
            <input type="submit" name="submit" value="Create account" class="form-btn">

            <p class="form-text">Already have an account? <a href="login_form.php">Log in</a></p>
        </form>
    </div>
</div>

<?php require_once 'includes/footer.php'; ?>
</body>
</html>