<?php
require_once 'includes/wq_db_connect.php';
session_start();
if (!isset($_SESSION['admin_name'])) {
    header("Location: login_form.php");
    exit();
}
require_once 'includes/csrf.php';
require_once 'includes/display_data.php';

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    header("Location: view_questions.php");
    exit();
}

if (isset($_POST['submit'])) {
    csrf_verify_form();
    $country  = $_POST['country'];
    $img_path = $_POST['img_path'];
    $question = $_POST['question'];
    $hint     = $_POST['hint'];
    $answer1  = $_POST['answer1'];
    $answer2  = $_POST['answer2'];
    $answer3  = $_POST['answer3'];

    if (!isset($_POST['is_correct1']) || ($_POST['is_correct1'] !== 'true' && $_POST['is_correct1'] !== 'false')) {
        $errors[] = "Correct/wrong selection is required for Answer 1.";
    } else {
        $is_correct1 = ($_POST['is_correct1'] === 'true') ? 1 : 0;
    }
    if (!isset($_POST['is_correct2']) || ($_POST['is_correct2'] !== 'true' && $_POST['is_correct2'] !== 'false')) {
        $errors[] = "Correct/wrong selection is required for Answer 2.";
    } else {
        $is_correct2 = ($_POST['is_correct2'] === 'true') ? 1 : 0;
    }
    if (!isset($_POST['is_correct3']) || ($_POST['is_correct3'] !== 'true' && $_POST['is_correct3'] !== 'false')) {
        $errors[] = "Correct/wrong selection is required for Answer 3.";
    } else {
        $is_correct3 = ($_POST['is_correct3'] === 'true') ? 1 : 0;
    }

    if (empty($country) || empty($img_path) || empty($question) || empty($hint) || empty($answer1) || empty($answer2) || empty($answer3)) {
        $errors[] = "All fields are required.";
    } elseif (!isset($errors)) {
        $stmt = $conn->prepare("UPDATE countries SET country=?, img_path=?, question=?, hint=?, answer1=?, is_correct1=?, answer2=?, is_correct2=?, answer3=?, is_correct3=? WHERE id=?");
        $stmt->bind_param("sssssisisii", $country, $img_path, $question, $hint, $answer1, $is_correct1, $answer2, $is_correct2, $answer3, $is_correct3, $id);
        if ($stmt->execute()) {
            $successMsg = "Question updated successfully!";
        } else {
            $errors[] = "Failed to update question: " . $stmt->error;
        }
        $stmt->close();
    }
}

// Fetch fresh DB row (after potential update)
$question = get_question_by_id($id);
if (!$question) {
    header("Location: view_questions.php");
    exit();
}

// If there were validation errors use POST values, otherwise use DB data
if (isset($_POST['submit']) && isset($errors)) {
    $fv = [
        'country'  => $_POST['country'],
        'img_path' => $_POST['img_path'],
        'question' => $_POST['question'],
        'hint'     => $_POST['hint'],
        'answer1'  => $_POST['answer1'],
        'answer2'  => $_POST['answer2'],
        'answer3'  => $_POST['answer3'],
    ];
    $ic1 = $_POST['is_correct1'] === 'true' ? 'true' : 'false';
    $ic2 = $_POST['is_correct2'] === 'true' ? 'true' : 'false';
    $ic3 = $_POST['is_correct3'] === 'true' ? 'true' : 'false';
} else {
    $fv  = $question;
    $ic1 = $question['is_correct1'] ? 'true' : 'false';
    $ic2 = $question['is_correct2'] ? 'true' : 'false';
    $ic3 = $question['is_correct3'] ? 'true' : 'false';
}

function selIf($ic, $value) {
    return $ic === $value ? 'selected' : '';
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorldQuiz – Edit Question</title>
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
        <?php $adminActivePage = 'edit_question'; require_once 'includes/admin_sidebar.php'; ?>
        <main class="admin-main">
            <div class="admin-page-header">
                <div class="admin-page-header-text">
                    <h1>Edit Question #<?php echo $id; ?></h1>
                    <p>Update the details for this question.</p>
                </div>
                <a href="view_questions.php" class="qform-cancel-btn">
                    <i class='bx bx-arrow-back'></i> Back to Questions
                </a>
            </div>

            <div class="qform-container">
                <?php if (isset($successMsg)): ?>
                <div class="qform-message success">
                    <i class='bx bx-check-circle'></i> <?php echo $successMsg; ?>
                </div>
                <?php endif; ?>
                <?php if (isset($errors)): foreach ($errors as $e): ?>
                <div class="qform-message error">
                    <i class='bx bx-error-circle'></i> <?php echo htmlspecialchars($e); ?>
                </div>
                <?php endforeach; endif; ?>

                <form action="" method="POST" class="qform">
                    <input type="hidden" name="csrf_token" value="<?php echo csrf_token(); ?>">

                    <div class="qform-section">
                        <div class="qform-section-title">Question Details</div>
                        <div class="qform-row two-col">
                            <div class="qform-field">
                                <label class="qform-label" for="country">Country / Landmark</label>
                                <input class="qform-input" type="text" id="country" name="country" value="<?php echo htmlspecialchars($fv['country']); ?>">
                            </div>
                            <div class="qform-field">
                                <label class="qform-label" for="img_path">Image Path</label>
                                <input class="qform-input" type="text" id="img_path" name="img_path" value="<?php echo htmlspecialchars($fv['img_path']); ?>">
                            </div>
                        </div>
                        <div class="qform-field">
                            <label class="qform-label" for="question">Question</label>
                            <input class="qform-input" type="text" id="question" name="question" value="<?php echo htmlspecialchars($fv['question']); ?>">
                        </div>
                        <div class="qform-field">
                            <label class="qform-label" for="hint">Hint</label>
                            <input class="qform-input" type="text" id="hint" name="hint" value="<?php echo htmlspecialchars($fv['hint']); ?>">
                        </div>
                    </div>

                    <div class="qform-section">
                        <div class="qform-section-title">Answer Options</div>
                        <div class="qform-row three-col">
                            <div class="answer-block">
                                <div class="answer-block-header">Answer 1</div>
                                <div class="qform-field">
                                    <label class="qform-label" for="answer1">Answer Text</label>
                                    <input class="qform-input" type="text" id="answer1" name="answer1" value="<?php echo htmlspecialchars($fv['answer1']); ?>">
                                </div>
                                <div class="qform-field">
                                    <label class="qform-label" for="is_correct1">Result</label>
                                    <select class="qform-select" id="is_correct1" name="is_correct1">
                                        <option value="true"  <?php echo selIf($ic1, 'true'); ?>>Correct</option>
                                        <option value="false" <?php echo selIf($ic1, 'false'); ?>>Wrong</option>
                                    </select>
                                </div>
                            </div>
                            <div class="answer-block">
                                <div class="answer-block-header">Answer 2</div>
                                <div class="qform-field">
                                    <label class="qform-label" for="answer2">Answer Text</label>
                                    <input class="qform-input" type="text" id="answer2" name="answer2" value="<?php echo htmlspecialchars($fv['answer2']); ?>">
                                </div>
                                <div class="qform-field">
                                    <label class="qform-label" for="is_correct2">Result</label>
                                    <select class="qform-select" id="is_correct2" name="is_correct2">
                                        <option value="true"  <?php echo selIf($ic2, 'true'); ?>>Correct</option>
                                        <option value="false" <?php echo selIf($ic2, 'false'); ?>>Wrong</option>
                                    </select>
                                </div>
                            </div>
                            <div class="answer-block">
                                <div class="answer-block-header">Answer 3</div>
                                <div class="qform-field">
                                    <label class="qform-label" for="answer3">Answer Text</label>
                                    <input class="qform-input" type="text" id="answer3" name="answer3" value="<?php echo htmlspecialchars($fv['answer3']); ?>">
                                </div>
                                <div class="qform-field">
                                    <label class="qform-label" for="is_correct3">Result</label>
                                    <select class="qform-select" id="is_correct3" name="is_correct3">
                                        <option value="true"  <?php echo selIf($ic3, 'true'); ?>>Correct</option>
                                        <option value="false" <?php echo selIf($ic3, 'false'); ?>>Wrong</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="qform-actions">
                        <input type="submit" name="submit" value="Save Changes" class="qform-submit-btn">
                        <a href="view_questions.php" class="qform-cancel-btn">Cancel</a>
                    </div>
                </form>
            </div>
        </main>
    </div>

    <?php require_once 'includes/footer.php'; ?>
</body>
</html>
