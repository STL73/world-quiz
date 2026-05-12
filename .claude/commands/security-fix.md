---
description: Fix all known security vulnerabilities in WorldQuiz one by one, in priority order. Confirms each fix before moving to the next.
---

Fix the known security vulnerabilities in this project in the following order. Read each file before editing it. After each fix, state clearly what was changed and why.

## Fix 1 — Plaintext passwords (`create_account.php`)
Replace the raw `$password` insert with `password_hash($password, PASSWORD_BCRYPT)`.
The `INSERT INTO users` statement should store the hashed value, not the plain text.

## Fix 2 — Plaintext password comparison (`login_form.php`)
The login query currently compares `password = ?` directly in SQL.
- Remove `password` from the SQL WHERE clause — query only by `email`
- After fetching the row, use `password_verify($input_password, $row['password'])` to validate
- If `password_verify()` returns false, treat as failed login

## Fix 3 — SQL injection in `delete_data.php`
Both `delete_question()` and `delete_user()` build SQL with string interpolation.
Replace each with:
```php
$stmt = $conn->prepare("DELETE FROM countries WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
```
Same pattern for the users delete.

## Fix 4 — SQL injection in `check_answer.php` (line 52)
Replace the raw query:
```php
$conn->query("SELECT star_tokens FROM score WHERE id = $user_id")
```
With a prepared statement binding `$user_id` as an integer.

## Fix 5 — Session fixation (`login_form.php`)
Add `session_regenerate_id(true);` immediately after setting the session variables on successful login, before the `header("Location: ...")` redirect.

## Fix 6 — Open admin registration (`create_account.php`)
The `<select name="user_type">` allows anyone to register as admin.
Remove the `<option value="admin">Admin</option>` option. All public registrations should create `user` type only. Hard-code `$user_type = 'user'` in the PHP and remove the select from the form.

## Fix 7 — CSRF protection on forms
Add a CSRF token to `login_form.php`, `create_account.php`, and `add_question.php`.
See the skill file `.claude/skills/csrf-protection.md` for the implementation pattern to use.

After completing all fixes, run the security-auditor agent to verify nothing was missed.
