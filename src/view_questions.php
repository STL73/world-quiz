<?php
session_start();
require_once 'includes/wq_db_connect.php';
if (!isset($_SESSION['admin_name'])) {
    header("Location: login_form.php");
    exit();
}
require_once 'includes/display_data.php';
$result = display_questions();
if (!$result) {
    die("Error in SQL query: " . $conn->error);
}
require_once 'includes/delete_data.php';
delete_question();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorldQuiz – Questions</title>
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
        <?php $adminActivePage = 'view_questions'; require_once 'includes/admin_sidebar.php'; ?>
        <main class="admin-main">
            <div class="admin-page-header">
                <div class="admin-page-header-text">
                    <h1>Questions</h1>
                    <p>View, edit, or delete quiz questions.</p>
                </div>
                <a href="add_question.php" class="btn-cta btn-cta-primary">
                    <i class='bx bx-plus'></i> Add Question
                </a>
            </div>

            <div class="questions-list">
                <?php while ($row = $result->fetch_assoc()): ?>
                <div class="q-card">
                    <div class="q-card-inner">
                        <div class="q-card-body">
                            <div class="q-card-meta">
                                <span class="q-id-badge">ID <?php echo $row['id']; ?></span>
                                <span class="q-country-name"><?php echo htmlspecialchars($row['country']); ?></span>
                            </div>

                            <div>
                                <div class="q-hint-label">Question</div>
                                <div class="q-hint"><?php echo htmlspecialchars($row['question']); ?></div>
                            </div>

                            <div class="q-answers">
                                <?php
                                $answers = [
                                    ['text' => $row['answer1'], 'correct' => $row['is_correct1']],
                                    ['text' => $row['answer2'], 'correct' => $row['is_correct2']],
                                    ['text' => $row['answer3'], 'correct' => $row['is_correct3']],
                                ];
                                foreach ($answers as $a):
                                ?>
                                <div class="q-answer-row <?php echo $a['correct'] ? 'correct-answer' : ''; ?>">
                                    <span class="q-answer-indicator">
                                        <?php if ($a['correct']): ?><i class='bx bx-check'></i><?php endif; ?>
                                    </span>
                                    <span class="q-answer-text"><?php echo htmlspecialchars($a['text']); ?></span>
                                </div>
                                <?php endforeach; ?>
                            </div>

                            <div>
                                <div class="q-hint-label">Hint</div>
                                <div class="q-hint"><?php echo htmlspecialchars($row['hint']); ?></div>
                            </div>
                        </div>

                        <div class="q-card-image">
                            <img src="<?php echo htmlspecialchars($row['img_path']); ?>" alt="<?php echo htmlspecialchars($row['country']); ?>">
                            <div class="q-card-actions">
                                <a href="edit_question.php?id=<?php echo $row['id']; ?>" class="q-btn q-btn-edit">
                                    <i class='bx bx-edit'></i> Edit
                                </a>
                                <a href="view_questions.php?delete=<?php echo $row['id']; ?>" class="q-btn q-btn-delete">
                                    <i class='bx bx-trash'></i> Delete
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                <?php endwhile; ?>
            </div>
        </main>
    </div>

    <?php require_once 'includes/footer.php'; ?>
</body>
</html>
