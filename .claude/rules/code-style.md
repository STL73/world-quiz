# Code Style

Conventions specific to WorldQuiz. Match the surrounding file when in doubt — the codebase is small and consistent.

## PHP

- **Tags:** open with `<?php`, never the short `<?` form. Closing `?>` is omitted at the end of pure PHP files.
- **Indentation:** 4 spaces.
- **Naming:**
  - Functions: `snake_case` (`get_score`, `display_users`, `csrf_verify_ajax`).
  - Variables: `snake_case` (`$user_id`, `$is_correct`, `$question_id`). camelCase appears in a few older spots but new code uses snake_case.
  - Constants: `UPPER_SNAKE_CASE` (rare in this codebase).
  - Files: `snake_case.php` for pages and endpoints; lowercase for includes.
- **Strings:** prefer double-quoted strings when interpolating, single-quoted otherwise. No mixing for the sake of consistency within a single line.
- **Comments:** short `//` comments above non-obvious logic. Multi-line block comments are reserved for the file header when there's a real architecture note to make.
- **Type hints:** not used in existing code. Don't introduce them piecemeal — would require a full pass.

## JavaScript

- **Indentation:** 2 spaces.
- **Naming:**
  - Variables and functions: `camelCase` (`currentQuestionId`, `showHintMessage`).
  - Constants: `UPPER_SNAKE_CASE` for module-level immutables.
  - DOM ids/classes referenced from JS: `kebab-case` (mirrors the HTML/CSS).
  - Fields received from PHP JSON keep their `snake_case` form (`data.star_tokens`) — do not rename on assignment.
- **Declarations:** `const` by default, `let` when reassignment is required, never `var`.
- **Strings:** single quotes by default; template literals when interpolating.
- **Functions:** named function declarations inside the `DOMContentLoaded` handler. Arrow functions only for short callbacks (`fetch().then(r => r.json())`).

## CSS

- **Indentation:** 2 spaces.
- **Selectors:** kebab-case class names. IDs only when JS needs a unique handle.
- **Custom properties:** defined at `:root` for design tokens (`--color-surface`, `--font-display`). Use the token, never repeat the literal value.
- **Animation:** prefer `transform` and `opacity` over `width`/`height`/`top`/`left`. Already enforced by the design system; new motion should follow the same rule.

## HTML (inside PHP)

- **Indentation:** 4 spaces.
- **Attributes:** lowercase, double-quoted. PHP echoes go inside the value (`<body data-user-id="<?php echo (int)$_SESSION['user_id']; ?>">`).
- **Escaping:** `<?php echo (int) ... ?>` for integers from session/DB; `<?php echo htmlspecialchars(...) ?>` for any string that could contain user input.
- **CSRF meta tag:** required in every page that issues AJAX.

## SQL

- **Keywords:** UPPERCASE (`SELECT`, `FROM`, `WHERE`, `INNER JOIN`).
- **Identifiers:** lowercase column and table names (`countries`, `users`, `score`, `star_tokens`).
- **One statement per `prepare` call.** No semicolon-separated multi-statements.
- **Always parameterized.** A bare `$conn->query("... $var ...")` is a bug to fix on sight.

## Commits

Follow the conventional commits format from the global guidelines:

```text
feat: add hint cooldown
fix: prevent column-name injection in check_answer
refactor: move user listing query into display_data
chore: bump boxicons CDN version
docs: clarify quiz gameplay loop in CLAUDE.md
```
