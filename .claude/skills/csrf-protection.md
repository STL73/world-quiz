# CSRF Protection — WorldQuiz Reference

WorldQuiz forms (`login_form.php`, `create_account.php`, `add_question.php`) have no CSRF protection. This is the pattern to add it without a framework.

## How it works

1. Generate a random token and store it in the session
2. Include the token as a hidden field in every form
3. On POST, compare the submitted token to the session token
4. If they don't match, reject the request

## Implementation

### Token generation helper

Add this function to a shared file (or inline it at the top of each form page):

```php
function generate_csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf_token(string $token): bool {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}
```

### In the form page (PHP at top)

```php
<?php
session_start();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf_token($_POST['csrf_token'] ?? '')) {
        die("Invalid request.");
    }
    // ... rest of form handling
}

$token = generate_csrf_token();
?>
```

### In the HTML form

```html
<form action="" method="POST">
    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($token); ?>">
    <!-- rest of form fields -->
</form>
```

## Applied to each WorldQuiz form

### `login_form.php`

Add token generation before the HTML, add hidden field inside `<form>`, and validate at the top of the POST block.

### `create_account.php`

Same pattern. The token check goes before any database queries.

### `add_question.php`

Admin-only form — still needs CSRF protection because an attacker could trick an admin into submitting.

## Why `hash_equals()`?

`hash_equals()` does a constant-time comparison, preventing timing attacks that could leak the token through response time differences. Never use `===` or `==` to compare CSRF tokens.
