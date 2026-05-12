<?php
require_once 'includes/wq_db_connect.php';
session_start();
if (!isset($_SESSION['admin_name'])) {
    header("Location: login_form.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorldQuiz – Admin Panel</title>
    <link rel="stylesheet" href="CSS/style.css?v=<?php echo @filemtime(__DIR__ . '/CSS/style.css'); ?>">
    <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
</head>
<body>
    <header>
        <div class="logo"><i class='bx bx-globe'></i>WorldQuiz.</div>
        <div class="nav-bar">
            <h2 class="content">Hello, <span><?php echo ucfirst(htmlspecialchars($_SESSION['admin_name'])); ?></span></h2>
        </div>
    </header>

    <div class="admin-layout">
        <?php $adminActivePage = 'dashboard'; require_once 'includes/admin_sidebar.php'; ?>
        <main class="admin-main">
            <div class="admin-page-header">
                <div class="admin-page-header-text">
                    <h1>Dashboard</h1>
                    <p>Welcome back, <?php echo ucfirst(htmlspecialchars($_SESSION['admin_name'])); ?>. Manage your quiz content below.</p>
                </div>
            </div>
            <div class="admin-stats-grid">
                <a href="view_questions.php" class="admin-stat-card">
                    <i class='bx bx-list-ul'></i>
                    <div>
                        <h3>Questions</h3>
                        <p>View, edit or delete questions</p>
                    </div>
                </a>
                <a href="view_users.php" class="admin-stat-card">
                    <i class='bx bx-group'></i>
                    <div>
                        <h3>Users</h3>
                        <p>Manage user accounts</p>
                    </div>
                </a>
                <a href="view_user_score.php" class="admin-stat-card">
                    <i class='bx bx-trophy'></i>
                    <div>
                        <h3>Scores</h3>
                        <p>View player leaderboard</p>
                    </div>
                </a>
            </div>
        </main>
    </div>

    <?php require_once 'includes/footer.php'; ?>
</body>
</html>
