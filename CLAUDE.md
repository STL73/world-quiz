# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WorldQuiz is a geography quiz web application. Players identify world landmarks from images and pick the right answer (a landmark name, a city, or similar) from three multiple-choice options. Roles: regular users (play quizzes, earn star tokens, level up) and admins (manage questions and users).

## Repository layout

The project was restructured into a clean tree:

```text
WorldQuiz/
├── .htaccess              # Apache rewrite: every request → src/ (URL stays clean)
├── src/                   # the entire web app
│   ├── index.php          # landing page (entry after redirect)
│   ├── login_form.php / create_account.php / logout.php
│   ├── user_panel.php     # player dashboard
│   ├── quiz.php           # gameplay page
│   ├── admin_panel.php    # admin dashboard
│   ├── add_question.php / edit_question.php
│   ├── view_questions.php / view_users.php / view_user_score.php
│   ├── get_question.php / check_answer.php / save_progress.php / use_hint.php   # JSON endpoints
│   ├── CSS/style.css      # all styles
│   ├── JS/app.js          # all client-side gameplay JS
│   ├── Images/            # 46 landmark photos, organised by country
│   └── includes/
│       ├── wq_db_connect.php  # DB connection (host/user/pass/db)
│       ├── csrf.php           # CSRF token helpers
│       ├── display_data.php   # all SELECT queries (prepared statements)
│       ├── delete_data.php    # DELETE queries
│       ├── footer.php         # shared footer partial
│       ├── admin_sidebar.php  # admin navigation partial
│       └── user_sidebar.php   # player navigation partial
├── database/
│   ├── seed.sql                  # CREATE TABLE + 46 question rows (with new `question` column)
│   └── World Qiuz db code.sql    # original schema scratchpad (kept for reference)
├── graphify-out/          # knowledge-graph output (regenerable; see .graphifyignore)
├── palette-preview.html   # one-off colour-palette comparison page (safe to delete)
├── CLAUDE.md              # this file
├── CLAUDE.local.md        # personal notes; should not be committed
└── .graphifyignore        # only src/ is indexed by graphify
```

## Commands

No build tools or package manager. The app runs directly on a PHP + MySQL stack.

### Local development

- Requires PHP with MySQLi extension and a MySQL server (XAMPP, WAMP, or similar)
- Point the web-server document root at the project root (typically `C:\xampp\htdocs\WorldQuiz\`)
- Access the app at **`http://localhost/WorldQuiz/`** — the root `.htaccess` silently routes every URL into `src/` (URL bar stays clean, no `src/` visible)

### Database setup

- Create database: `wq_db`
- Run `database/seed.sql` to create the `countries` table and seed 46 rows.
- The `users` and `score` tables must still be created manually (schema is inferred from `src/includes/wq_db_connect.php` and the auth/scoring code).

**Database credentials** are in `src/includes/wq_db_connect.php`:
- Host: `localhost`, user: `root`, password: `""` (empty), database: `wq_db`

## Architecture

**No framework.** Procedural PHP with file-based routing — each `.php` file is a page or JSON endpoint. All app code lives in `src/`.

### Authentication flow

```text
src/login_form.php → sets $_SESSION['user_name'] | $_SESSION['admin_name']
                   → redirects to src/user_panel.php | src/admin_panel.php
```

Session guards at the top of protected pages check `isset($_SESSION['user_name'])` or `isset($_SESSION['admin_name'])`.

### Quiz gameplay loop (AJAX-driven)

```text
src/quiz.php (page load)
  → JS/app.js calls get_question.php?id=X  → JSON {question, hint, img_path, answer1/2/3, ...}
  → user submits → check_answer.php (POST JSON) → updates score/level in DB, returns next question id
  → user requests hint → use_hint.php (POST JSON) → returns hint, marks hint used in session
  → user navigates away → save_progress.php (POST JSON) → persists current question id
```

### Data layer

Two include files handle all DB reads/writes:

- `src/includes/display_data.php` — all `SELECT` queries (users, questions, scores); uses prepared statements
- `src/includes/delete_data.php` — `DELETE` queries for questions and users

**Admin endpoints:** `src/view_questions.php`, `src/view_users.php`, `src/view_user_score.php`, `src/add_question.php`, `src/edit_question.php`

### Database tables

| Table | Key columns |
|-------|-------------|
| `users` | id, name, email, password, user_type ('admin'\|'user') |
| `score` | id (FK→users), star_tokens, level |
| `countries` | id, country, img_path, **question**, hint, answer1/2/3, is_correct1/2/3 |

Level is derived as `floor(star_tokens / 100) + 1`.

**Frontend:** Vanilla JS in `src/JS/app.js` — no framework, no build step. CSS in `src/CSS/style.css` — Cinematic Dark + Editorial Glass design system (Playfair Display + Inter via Google Fonts, Boxicons via CDN).

**Images:** 46 landmark photos in `src/Images/`, organised by country folder. Referenced by the `img_path` column in `countries` (relative paths like `Images/France/q1-Eiffel Tower in Paris.jpg` — resolved relative to `src/` at runtime).

## Security Status

All previously known issues have been resolved:

- Passwords hashed with `password_hash()` / `password_verify()`; plaintext passwords are migrated automatically on first login
- All SQL queries use prepared statements with bound parameters
- CSRF protection applied to all POST endpoints (`src/includes/csrf.php`)
- `session_regenerate_id(true)` called after successful login
- Admin pages all redirect to login if `$_SESSION['admin_name']` is not set
- `$answer_index` in `check_answer.php` is validated as 1, 2, or 3 before being interpolated into a column name

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read `graphify-out/GRAPH_REPORT.md` before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF `graphify-out/wiki/index.md` EXISTS, navigate it instead of reading raw files.
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- After the recent restructure (PHP moved to `src/`), the existing `graphify-out/` cache is stale. Regenerate with `/graphify .` when next using the graph.

`.graphifyignore` is configured to only index `src/` — everything else (database/, graphify-out/, palette-preview.html, etc.) is excluded.
