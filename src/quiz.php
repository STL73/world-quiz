<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header("Location: login_form.php");
    exit();
}
require_once 'includes/wq_db_connect.php';
require_once 'includes/csrf.php';
require_once 'includes/display_data.php';
$score        = get_score();
$level        = $score ? (int)$score['level']      : 1;
$tokens       = $score ? (int)$score['star_tokens'] : 0;
$savedQuestionId = isset($_SESSION['current_question_id']) ? (int)$_SESSION['current_question_id'] : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?php echo csrf_token(); ?>">
    <title>WorldQuiz – Play</title>
    <link rel="stylesheet" href="CSS/style.css?v=<?php echo @filemtime(__DIR__ . '/CSS/style.css'); ?>">
    <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
</head>
<body data-user-id="<?php echo (int)$_SESSION['user_id']; ?>"
      data-saved-question="<?php echo $savedQuestionId; ?>">

<header>
    <div class="logo"><i class='bx bx-globe'></i>WorldQuiz.</div>
    <div class="nav-bar">
        <h2 class="content">Playing as <span><?php echo ucfirst(htmlspecialchars($_SESSION['user_name'])); ?></span></h2>
    </div>
</header>

<div class="admin-layout">
    <?php $userActivePage = 'play'; require_once 'includes/user_sidebar.php'; ?>

    <main class="admin-main">

        <!-- Top bar: back button + live token badge -->
        <div class="quiz-topbar">
            <a href="user_panel.php" class="quiz-back-btn" id="back-to-dashboard">
                <i class='bx bx-arrow-back'></i> Dashboard
            </a>
            <div class="quiz-token-badge">
                <i class='bx bxs-star' id="star"></i>
                <span id="star-tokens"><?php echo $tokens; ?></span> tokens
                <span class="badge-level">· Lv <span id="current-level"><?php echo $level; ?></span></span>
            </div>
        </div>

        <!-- Welcome card — shown on page load -->
        <div class="quiz-welcome-card welcome">
            <div class="quiz-welcome-icon">
                <i class='bx bx-world'></i>
            </div>
            <h2>Welcome to WorldQuiz!</h2>
            <p>Test your knowledge of world landmarks. Select the correct country for each image. Earn star tokens and level up!</p>
            <div class="quiz-rules-grid">
                <div class="quiz-rule-item">
                    <i class='bx bx-check-circle'></i>
                    <span>Correct answer: <strong>+10 tokens</strong></span>
                </div>
                <div class="quiz-rule-item">
                    <i class='bx bx-x-circle'></i>
                    <span>Wrong answer: <strong>+0 tokens</strong></span>
                </div>
                <div class="quiz-rule-item">
                    <i class='bx bx-help-circle'></i>
                    <span>Hint + correct: <strong>+5 tokens</strong></span>
                </div>
            </div>
            <?php if ($savedQuestionId > 0): ?>
            <div class="quiz-continue-row">
                <button class="start-btn quiz-start-btn" data-mode="continue">Continue Quiz</button>
                <button class="start-btn quiz-start-btn quiz-start-fresh" data-mode="fresh">Start Fresh</button>
            </div>
            <?php else: ?>
            <button class="start-btn quiz-start-btn" data-mode="fresh">Start Quiz</button>
            <?php endif; ?>
        </div>

        <!-- Question card — shown after Start is clicked -->
        <div class="quiz-question-card question-box" style="display:none">

            <!-- Full-card feedback overlay -->
            <div id="answer-feedback" aria-live="polite"></div>

            <!-- Landmark image — flush at top, full width -->
            <div class="quiz-image-col">
                <img src="" id="q-img" alt="Photograph of a world landmark" data-question-id="">
            </div>

            <!-- Card body: everything below the image -->
            <div class="quiz-card-body">

                <!-- Hint banner — shown when hint is revealed -->
                <div id="hint-message" class="quiz-hint-banner" style="display:none"></div>

                <h2 class="quiz-question-title" id="q-question"></h2>

                <!-- 3 answer options in a row -->
                <div class="quiz-answers-row">
                    <div class="input-box">
                        <input type="radio" name="answer" id="answer1" value="1">
                        <label for="answer1"></label>
                    </div>
                    <div class="input-box">
                        <input type="radio" name="answer" id="answer2" value="2">
                        <label for="answer2"></label>
                    </div>
                    <div class="input-box">
                        <input type="radio" name="answer" id="answer3" value="3">
                        <label for="answer3"></label>
                    </div>
                </div>

                <p id="error-message" role="alert" style="display:none"></p>

                <div class="quiz-action-bar">
                    <button id="get-hint" class="quiz-hint-btn">
                        <i class='bx bx-help-circle'></i> Get Hint
                    </button>
                    <button id="submit-answer" class="quiz-submit-btn">Submit Answer</button>
                </div>

            </div>
        </div>

    </main>
</div>

<?php require_once 'includes/footer.php'; ?>
<script src="JS/app.js"></script>
</body>
</html>
