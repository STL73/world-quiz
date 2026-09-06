# API Rules

WorldQuiz has no formal REST API — just a small set of AJAX JSON endpoints that power the gameplay loop. Conventions below keep them consistent.

## Existing endpoints

All live in `src/` as individual `.php` files. The frontend calls them via `fetch` from `app.js`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `get_question.php` | GET (query string) | Return one question by id: `{question, hint, img_path, answer1, answer2, answer3, ...}` |
| `check_answer.php` | POST (JSON body) | Validate an answer, update score, return correctness and new score |
| `save_progress.php` | POST (JSON body) | Persist the user's current question id so the quiz resumes on return |
| `use_hint.php` | POST (JSON body) | Mark the hint as used for the current question; return the hint text |

## Adding a new endpoint

1. Decide if it's a read (GET, query string) or a write (POST, JSON body).
2. Name the file with a verb-first snake_case name: `get_*.php`, `check_*.php`, `save_*.php`, `delete_*.php`.
3. Follow the JSON endpoint header pattern in `backend.md`.
4. Always send `Content-Type: application/json` and respond with `echo json_encode([...])`.

## Request format

- **GET endpoints** take parameters from `$_GET`. Validate types explicitly (`(int) $_GET['id']`).
- **POST endpoints** parse the body with `json_decode(file_get_contents("php://input"), true)`. Never read POST data via `$_POST` for these — the frontend sends JSON, not form-encoded.
- Required keys are checked with `isset($data['key1'], $data['key2'], ...)` before use. Missing keys return an error response immediately, never silently default.

## Response shape

Two consistent shapes — pick one per endpoint and stick to it:

**Success:**

```json
{ "field1": "value", "field2": 42 }
```

Direct payload, no `success` wrapper. The presence of expected keys signals success.

**Error:**

```json
{ "error": "Human-readable message." }
```

Always a single `error` key with a short, user-safe string. Never include stack traces, SQL fragments, or internal IDs in the error message.

After echoing an error, call `exit()` so no further output reaches the client.

## Auth and CSRF

- All POST endpoints require a valid CSRF token. Call `csrf_verify_ajax()` immediately after `require_once 'includes/csrf.php'`.
- GET endpoints that read user-scoped data check `$_SESSION['user_id']` exists and respond with an error if not.
- Admin-only endpoints check `$_SESSION['admin_name']` instead.
- Never trust the user id from the request body — read it from `$_SESSION['user_id']`.

## Input validation rules

- **Integers from the request:** cast with `(int)` and check the result is in the expected range.
- **Indices that map to column names (e.g. `is_correct$n`):** validate with `in_array($n, [allowed], true)` before interpolating.
- **Strings:** trim and reject empty for required fields; never use the value in SQL outside a prepared statement.

## Frontend contract

- `app.js` reads `<meta name="csrf-token">` once on load and sends it in the `X-CSRF-Token` header on every POST.
- The frontend expects `error` to be present on failure and absent on success — `if (response.error) { ... }` is the pattern.
- The frontend never retries failed requests automatically; surface the error message via `showError()`.
