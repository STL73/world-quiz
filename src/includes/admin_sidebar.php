<?php
// Set $adminActivePage before including this file.
// Valid values: 'dashboard', 'view_questions', 'add_question', 'view_users', 'view_scores', 'edit_question'
if (!isset($adminActivePage)) $adminActivePage = '';
?>
<aside class="admin-sidebar">
    <div class="sidebar-header">
        <div class="sidebar-admin-label">Admin Panel</div>
        <div class="sidebar-admin-name"><?php echo htmlspecialchars($_SESSION['admin_name']); ?></div>
    </div>
    <nav class="sidebar-nav">
        <div class="sidebar-section-label">Overview</div>
        <a href="admin_panel.php" class="sidebar-link <?php echo $adminActivePage === 'dashboard' ? 'active' : ''; ?>">
            <i class='bx bx-grid-alt'></i> Dashboard
        </a>
        <div class="sidebar-section-label">Content</div>
        <a href="view_questions.php" class="sidebar-link <?php echo in_array($adminActivePage, ['view_questions', 'edit_question']) ? 'active' : ''; ?>">
            <i class='bx bx-list-ul'></i> Questions
        </a>
        <a href="add_question.php" class="sidebar-link <?php echo $adminActivePage === 'add_question' ? 'active' : ''; ?>">
            <i class='bx bx-plus-circle'></i> Add Question
        </a>
        <div class="sidebar-section-label">Users</div>
        <a href="view_users.php" class="sidebar-link <?php echo $adminActivePage === 'view_users' ? 'active' : ''; ?>">
            <i class='bx bx-group'></i> All Users
        </a>
        <a href="view_user_score.php" class="sidebar-link <?php echo $adminActivePage === 'view_scores' ? 'active' : ''; ?>">
            <i class='bx bx-trophy'></i> Scores
        </a>
    </nav>
    <div class="sidebar-footer">
        <a href="logout.php" class="sidebar-logout-btn">
            <i class='bx bx-log-out'></i> Logout
        </a>
    </div>
</aside>
