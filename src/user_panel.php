<?php
require_once 'includes/wq_db_connect.php';
require_once 'includes/display_data.php';
session_start();
if (!isset($_SESSION['user_name'])) {
    header("Location: login_form.php");
    exit();
}
$score        = get_score();
$level        = $score ? (int)$score['level']       : 1;
$tokens       = $score ? (int)$score['star_tokens']  : 0;
$levelProgress = $tokens % 100;

// Find a landmark photo to use as the hero background:
//   1. If the user is mid-quiz, use the saved question's image (continue UX)
//   2. Otherwise grab any random landmark (fresh start UX)
$savedQuestionId = isset($_SESSION['current_question_id']) ? (int)$_SESSION['current_question_id'] : 0;
$heroRow = null;
if ($savedQuestionId > 0) {
    $stmt = $conn->prepare("SELECT country, img_path FROM countries WHERE id = ?");
    $stmt->bind_param("i", $savedQuestionId);
    $stmt->execute();
    $heroRow = $stmt->get_result()->fetch_assoc();
    $stmt->close();
}
if (!$heroRow) {
    $stmt = $conn->prepare("SELECT country, img_path FROM countries ORDER BY RAND() LIMIT 1");
    $stmt->execute();
    $heroRow = $stmt->get_result()->fetch_assoc();
    if ($stmt) $stmt->close();
}
$heroIsContinue = ($savedQuestionId > 0 && $heroRow);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorldQuiz – Player Panel</title>
    <link rel="stylesheet" href="CSS/style.css?v=<?php echo @filemtime(__DIR__ . '/CSS/style.css'); ?>">
    <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
</head>
<body>
    <header>
        <div class="logo"><i class='bx bx-globe'></i>WorldQuiz.</div>
        <div class="nav-bar">
            <h2 class="content">Hello, <span><?php echo ucfirst(htmlspecialchars($_SESSION['user_name'])); ?></span></h2>
        </div>
    </header>

    <div class="admin-layout">
        <?php $userActivePage = 'dashboard'; require_once 'includes/user_sidebar.php'; ?>
        <main class="admin-main">

            <!-- Hero banner — landmark photo background -->
            <div class="user-hero-banner">
                <div class="user-hero-banner-bg" style="background-image: url('<?php echo htmlspecialchars($heroRow['img_path']); ?>');"></div>
                <div class="user-hero-banner-veil"></div>
                <div class="user-hero-banner-content">
                    <div class="user-hero-banner-text">
                        <div class="eyebrow">
                            <?php echo $heroIsContinue ? 'Pick up where you left off' : 'Welcome back, ' . ucfirst(htmlspecialchars($_SESSION['user_name'])); ?>
                        </div>
                        <h2>
                            <?php if ($heroIsContinue): ?>
                                Your next question awaits in <?php echo htmlspecialchars($heroRow['country']); ?>.
                            <?php else: ?>
                                Ready for your next round?
                            <?php endif; ?>
                        </h2>
                        <p>
                            <?php if ($heroIsContinue): ?>
                                You're <?php echo $levelProgress; ?> stars into Level <?php echo $level; ?> — keep the streak going.
                            <?php else: ?>
                                Forty-six landmarks waiting. Start fresh whenever you're ready.
                            <?php endif; ?>
                        </p>
                    </div>
                    <div class="user-hero-banner-cta">
                        <a href="quiz.php" class="btn-cta btn-cta-primary">
                            <?php echo $heroIsContinue ? 'Continue' : 'Play now'; ?>
                            <i class='bx bx-right-arrow-alt'></i>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Stats row -->
            <div class="user-stats-grid">
                <div class="user-stat-card">
                    <i class='bx bx-trophy'></i>
                    <div>
                        <h3>Level <?php echo $level; ?></h3>
                        <p>Current rank</p>
                    </div>
                </div>
                <div class="user-stat-card">
                    <i class='bx bxs-star'></i>
                    <div>
                        <h3><?php echo $tokens; ?> Tokens</h3>
                        <p>Total stars earned</p>
                    </div>
                </div>
                <div class="user-stat-card">
                    <i class='bx bx-bar-chart-alt-2'></i>
                    <div>
                        <h3><?php echo $levelProgress; ?> / 100</h3>
                        <p>Progress to next level</p>
                    </div>
                </div>
            </div>

            <!-- Level progress bar -->
            <div class="user-progress-section">
                <div class="user-progress-label">
                    <span>Level <?php echo $level; ?></span>
                    <span><?php echo $levelProgress; ?> / 100 tokens to next level</span>
                    <span>Level <?php echo $level + 1; ?></span>
                </div>
                <div class="user-progress-bar-wrap">
                    <div class="user-progress-bar-fill" style="width: <?php echo $levelProgress; ?>%"></div>
                </div>
            </div>

            <!-- Quick actions -->
            <div class="user-section-title">Quick Actions</div>
            <div class="user-actions-grid">
                <a href="quiz.php" class="user-action-card user-action-play">
                    <i class='bx bx-joystick'></i>
                    <div>
                        <h3>Play Game</h3>
                        <p>Start a new quiz round</p>
                    </div>
                </a>
                <div class="user-action-card user-action-disabled" aria-disabled="true">
                    <i class='bx bx-medal'></i>
                    <div>
                        <h3>Leaderboard</h3>
                        <p>Coming soon</p>
                    </div>
                </div>
                <div class="user-action-card user-action-disabled" aria-disabled="true">
                    <i class='bx bx-cog'></i>
                    <div>
                        <h3>Settings</h3>
                        <p>Coming soon</p>
                    </div>
                </div>
            </div>

        </main>
    </div>

    <?php require_once 'includes/footer.php'; ?>
</body>
</html>
