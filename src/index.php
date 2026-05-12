<?php
session_start();

// If the visitor is already logged in, skip the landing.
if (isset($_SESSION['admin_name'])) {
    header("Location: admin_panel.php");
    exit();
}
if (isset($_SESSION['user_name'])) {
    header("Location: user_panel.php");
    exit();
}

// Pull one random question for the static preview card.
// Falls back to hardcoded values if the DB is unavailable.
$previewRow = null;
if (file_exists(__DIR__ . '/includes/wq_db_connect.php')) {
    require_once __DIR__ . '/includes/wq_db_connect.php';
    if (isset($conn) && !$conn->connect_error) {
        $stmt = $conn->prepare("SELECT country, img_path, question, hint, answer1, is_correct1, answer2, is_correct2, answer3, is_correct3 FROM countries ORDER BY RAND() LIMIT 1");
        if ($stmt && $stmt->execute()) {
            $previewRow = $stmt->get_result()->fetch_assoc();
            $stmt->close();
        }
    }
}
if (!$previewRow) {
    $previewRow = [
        'country'     => 'Australia',
        'img_path'    => 'Images/Australia/q1-sydney opera house.jpg',
        'question'    => 'Which opera house is this?',
        'hint'        => 'Its shell-like roof sections were inspired, says its architect, by segments of an orange.',
        'answer1'     => 'Sydney Opera House',  'is_correct1' => 1,
        'answer2'     => 'Royal Opera House',   'is_correct2' => 0,
        'answer3'     => 'Vienna State Opera',  'is_correct3' => 0,
    ];
}
$previewAnswers = [
    ['text' => $previewRow['answer1'], 'correct' => (int)$previewRow['is_correct1']],
    ['text' => $previewRow['answer2'], 'correct' => (int)$previewRow['is_correct2']],
    ['text' => $previewRow['answer3'], 'correct' => (int)$previewRow['is_correct3']],
];

$countries = [
    'United Kingdom', 'France', 'Italy', 'Switzerland', 'Hungary', 'Germany',
    'USA', 'Canada', 'Brazil', 'UAE', 'Egypt',
    'India', 'China', 'Japan', 'Malaysia', 'Australia',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorldQuiz – See the world, one landmark at a time</title>
    <link rel="stylesheet" href="CSS/style.css?v=<?php echo @filemtime(__DIR__ . '/CSS/style.css'); ?>">
    <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">
</head>
<body class="landing">

<!-- Floating glass nav -->
<nav class="landing-nav" aria-label="Primary">
    <div class="logo"><i class='bx bx-globe'></i>WorldQuiz.</div>
    <div class="landing-nav-cta">
        <a href="login_form.php" class="landing-nav-link">Log in</a>
        <a href="create_account.php" class="landing-nav-link primary">Get started</a>
    </div>
</nav>

<!-- Hero -->
<section class="landing-hero">
    <div class="landing-hero-photos" aria-hidden="true">
        <img src="Images/France/q1-Eiffel Tower in Paris.jpg" alt="">
        <img src="Images/UAE/q3-burj al arab.jpg" alt="">
        <img src="Images/Egypt/q1-the great pyramids.jpg" alt="">
        <img src="Images/Australia/q1-sydney opera house.jpg" alt="">
    </div>
    <div class="landing-hero-veil"></div>

    <div class="landing-hero-content">
        <span class="landing-hero-eyebrow">
            <i class='bx bxs-star'></i> A geography quiz for the curious
        </span>
        <h1>See the world,<br><em>one landmark</em> at a time.</h1>
        <p class="lead">
            Forty-six photographs. Sixteen countries. Three answers per question, one of them right.
            Earn star tokens, climb levels, and find out how much of the world you actually recognise.
        </p>
        <div class="landing-hero-cta">
            <a href="create_account.php" class="btn-cta btn-cta-primary">
                Start playing <i class='bx bx-right-arrow-alt'></i>
            </a>
            <a href="login_form.php" class="btn-cta btn-cta-ghost">
                I have an account
            </a>
        </div>
    </div>
</section>

<!-- Stat strip -->
<div class="landing-stat-strip">
    <div class="landing-stat-strip-inner">
        <div class="landing-stat">
            <div class="landing-stat-num">16</div>
            <div class="landing-stat-label">Countries</div>
        </div>
        <div class="landing-stat">
            <div class="landing-stat-num">46</div>
            <div class="landing-stat-label">Landmarks</div>
        </div>
        <div class="landing-stat">
            <div class="landing-stat-num">∞</div>
            <div class="landing-stat-label">Replays</div>
        </div>
    </div>
</div>

<!-- How it works -->
<section class="landing-section reveal-on-scroll">
    <div class="landing-section-eyebrow">How it works</div>
    <h2 class="landing-section-title">Three steps. <em>That's it.</em></h2>
    <p class="landing-section-sub">No tutorial. No paywall. No 200 MB download. Pick the right answer, earn a star, level up.</p>

    <div class="landing-how-grid">
        <article class="landing-how-card">
            <div class="landing-how-num">01</div>
            <h3>See a landmark</h3>
            <p>A real photograph appears. Could be the Eiffel Tower at golden hour or a riverfront in Shanghai. No clues yet — just the image.</p>
        </article>
        <article class="landing-how-card">
            <div class="landing-how-num">02</div>
            <h3>Pick the answer</h3>
            <p>Three options. One is right. Stuck? Reveal a hint at the cost of half the reward. Or guess — sometimes that's more fun anyway.</p>
        </article>
        <article class="landing-how-card">
            <div class="landing-how-num">03</div>
            <h3>Earn star tokens</h3>
            <p>+10 for a clean answer. +5 after a hint. Every hundred tokens bumps you a level. Your progress saves automatically, even mid-question.</p>
        </article>
    </div>
</section>

<!-- Static preview quiz card -->
<section class="landing-section reveal-on-scroll" id="preview">
    <div class="landing-section-eyebrow">What a question looks like</div>
    <h2 class="landing-section-title">A real <em>question card</em>, untouched.</h2>
    <p class="landing-section-sub">This is exactly what you'll see during a round — same image, same hint, same three buttons. Just not interactive here.</p>

    <div class="landing-preview-wrap">
        <div class="landing-preview-grid">
            <div class="landing-preview-photo">
                <img src="<?php echo htmlspecialchars($previewRow['img_path']); ?>" alt="<?php echo htmlspecialchars($previewRow['country']); ?>">
            </div>
            <div class="landing-preview-body">
                <div class="landing-preview-hint-banner">
                    <i class='bx bx-help-circle'></i>
                    <span><?php echo htmlspecialchars($previewRow['hint']); ?></span>
                </div>
                <h3 class="landing-preview-question"><?php echo htmlspecialchars($previewRow['question']); ?></h3>
                <div class="landing-preview-answers">
                    <?php foreach ($previewAnswers as $a): ?>
                    <div class="landing-preview-answer <?php echo $a['correct'] ? 'correct' : ''; ?>">
                        <?php echo htmlspecialchars($a['text']); ?>
                    </div>
                    <?php endforeach; ?>
                </div>
                <div class="landing-preview-action-bar">
                    <span class="landing-preview-btn-hint">
                        <i class='bx bx-help-circle'></i> Get Hint
                    </span>
                    <span class="landing-preview-btn-submit">Submit Answer</span>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Country cloud -->
<section class="landing-section reveal-on-scroll">
    <div class="landing-section-eyebrow">Discover landmarks from</div>
    <h2 class="landing-section-title">Sixteen countries. <em>Every continent except Antarctica.</em></h2>
    <p class="landing-section-sub">From the Taj Mahal to the Great Pyramids, from Tower Bridge to Trump Tower Chicago — the photo set spans Europe, Asia, the Americas, Africa, and Oceania.</p>

    <div class="landing-country-cloud">
        <?php foreach ($countries as $c): ?>
            <span class="country-chip"><i class='bx bx-map-pin'></i><?php echo htmlspecialchars($c); ?></span>
        <?php endforeach; ?>
    </div>
</section>

<!-- Final CTA -->
<section class="landing-cta-final reveal-on-scroll">
    <h2>Ready to test what you actually know?</h2>
    <p>Free account. Forty-six questions waiting. Your first ten star tokens are on the house.</p>
    <a href="create_account.php" class="btn-cta btn-cta-primary">
        Create your account <i class='bx bx-right-arrow-alt'></i>
    </a>
</section>

<?php require_once 'includes/footer.php'; ?>

<script>
// Scroll-reveal — respects prefers-reduced-motion via CSS.
(function () {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.reveal-on-scroll').forEach(function (el) {
        io.observe(el);
    });
})();
</script>
</body>
</html>
