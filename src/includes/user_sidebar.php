<?php
// Set $userActivePage before including this file.
// Valid values: 'dashboard', 'play'
if (!isset($userActivePage)) $userActivePage = '';
?>
<aside class="admin-sidebar">
    <div class="sidebar-header">
        <div class="sidebar-admin-label">Player</div>
        <div class="sidebar-admin-name"><?php echo htmlspecialchars($_SESSION['user_name']); ?></div>
    </div>
    <nav class="sidebar-nav">
        <div class="sidebar-section-label">Navigation</div>
        <a href="user_panel.php" class="sidebar-link <?php echo $userActivePage === 'dashboard' ? 'active' : ''; ?>">
            <i class='bx bx-grid-alt'></i> Dashboard
        </a>
        <a href="quiz.php" class="sidebar-link <?php echo $userActivePage === 'play' ? 'active' : ''; ?>">
            <i class='bx bx-joystick'></i> Play Game
        </a>
        <div class="sidebar-section-label">Account</div>
        <span class="sidebar-link sidebar-link-disabled" aria-disabled="true">
            <i class='bx bx-cog'></i> Settings
            <span class="sidebar-soon-badge">Soon</span>
        </span>
    </nav>
    <div class="sidebar-footer">
        <a href="logout.php" class="sidebar-logout-btn">
            <i class='bx bx-log-out'></i> Logout
        </a>
    </div>
</aside>
