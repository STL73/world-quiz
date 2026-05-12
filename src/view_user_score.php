<?php
session_start();
require_once 'includes/wq_db_connect.php';
if (!isset($_SESSION['admin_name'])) {
    header("Location: login_form.php");
    exit();
}
require_once 'includes/display_data.php';
$score = user_score();
if (!$score) {
    die("Error in SQL query: " . $conn->error);
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorldQuiz – Scores</title>
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
        <?php $adminActivePage = 'view_scores'; require_once 'includes/admin_sidebar.php'; ?>
        <main class="admin-main">
            <div class="admin-page-header">
                <div class="admin-page-header-text">
                    <h1>Scores</h1>
                    <p>View player star tokens and levels.</p>
                </div>
            </div>

            <div class="admin-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Type</th>
                            <th>Star Tokens</th>
                            <th>Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php while ($row = $score->fetch_assoc()): ?>
                        <tr>
                            <td><?php echo $row['id']; ?></td>
                            <td><?php echo htmlspecialchars($row['name']); ?></td>
                            <td><?php echo htmlspecialchars($row['email']); ?></td>
                            <td>
                                <span class="user-type-badge <?php echo htmlspecialchars($row['user_type']); ?>">
                                    <?php echo htmlspecialchars($row['user_type']); ?>
                                </span>
                            </td>
                            <td>
                                <span class="score-badge">
                                    <i class='bx bxs-star'></i> <?php echo $row['star_tokens']; ?>
                                </span>
                            </td>
                            <td>
                                <span class="level-badge">Lv <?php echo $row['level']; ?></span>
                            </td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            </div>
        </main>
    </div>

    <?php require_once 'includes/footer.php'; ?>
</body>
</html>
