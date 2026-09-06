# Backend Rules

WorldQuiz is intentionally procedural PHP — no Composer, no autoloader, no framework, no DI, no DTOs. The global PHP rules in `~/.claude/rules/php/` describe a modern OOP/framework setup; **WorldQuiz overrides them** with the conventions below.

## Stack constraints

- Plain PHP files served directly by Apache. No Composer, no `vendor/`, no autoloader.
- MySQLi only (no PDO, no Doctrine, no Eloquent).
- No `declare(strict_types=1)` — the existing code does not use it; do not introduce it page-by-page.
- No PSR-12 reformatting passes — match the surrounding file's style when editing.

## File-based routing

- Every `.php` file in `src/` is either a page (renders HTML) or a JSON endpoint. There is no router.
- The root `.htaccess` silently rewrites every URL into `src/`. URLs stay clean (`localhost/WorldQuiz/quiz.php`, not `localhost/WorldQuiz/src/quiz.php`).
- Page filenames are snake_case (`view_questions.php`, `user_panel.php`). JSON endpoint filenames are also snake_case verbs (`get_question.php`, `check_answer.php`).

## Page structure (protected pages)

Every protected page starts with:

```php
<?php
session_start();
if (!isset($_SESSION['user_id'])) {       // or $_SESSION['admin_name'] for admin pages
    header("Location: login_form.php");   // or admin_panel.php-friendly equivalent
    exit();
}
require_once 'includes/wq_db_connect.php';
require_once 'includes/csrf.php';
require_once 'includes/display_data.php'; // only if the page renders DB data
```

Do not skip the session guard. Do not reorder the requires — `wq_db_connect.php` defines `$conn` and must load first.

## JSON endpoint structure

Every JSON endpoint starts with:

```php
<?php
session_start();
header('Content-Type: application/json');
require 'includes/wq_db_connect.php';
require_once 'includes/csrf.php';
csrf_verify_ajax();
$data = json_decode(file_get_contents("php://input"), true);
```

Then validate inputs explicitly, run prepared queries, and `echo json_encode([...])` the response.

## Database access

- **All reads go through `includes/display_data.php`.** Add a new function there rather than putting a `SELECT` inline in a page. Functions use `global $conn;` (intentional for this codebase — do not refactor into DI).
- **All deletes go through `includes/delete_data.php`** with the same pattern.
- **Inserts and updates** stay inline in the endpoint or admin page that owns them (e.g. `add_question.php`, `check_answer.php`).
- **Every query uses a prepared statement** with `bind_param`. String interpolation into SQL is a security regression.
- When the query needs a dynamic column name (e.g. `is_correct$answer_index`), validate the variable against a fixed allowlist (`in_array($answer_index, [1, 2, 3], true)`) before interpolating.

## Auth and sessions

- User sessions use `$_SESSION['user_id']` and `$_SESSION['user_name']`. Admin sessions use `$_SESSION['admin_name']`.
- Passwords are stored with `password_hash($pw, PASSWORD_BCRYPT)` and verified with `password_verify`.
- `session_regenerate_id(true)` runs immediately after successful login, before the redirect.
- CSRF tokens come from `includes/csrf.php`. Every POST endpoint calls `csrf_verify_ajax()` (AJAX) or checks the form token (HTML form post).

## Protected files

- `src/includes/wq_db_connect.php` — DB credentials live here; do not move or rename.
- `src/includes/csrf.php` — token generation logic; do not reimplement elsewhere.
- `src/.htaccess` is implicit via the root `.htaccess` — do not add a second one inside `src/`.
