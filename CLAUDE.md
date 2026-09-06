# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Live memory lives in the Evolving Brain

**Before doing anything in this project, read this page first:**

- `C:\Users\slavi\Evolving Brain\Projects\Coding\world-quiz.md`

It is a single dossier: **compiled truth** on top (current state, blockers, next action) and an
**append-only timeline** underneath (dated history, every entry cited). Trust its compiled-truth
section over anything in this file or any README.

Check it for contradiction and unverified-claim callouts before acting on anything they touch.

This `CLAUDE.md` holds **stable** config only - stack, scope, constraints, output location. Anything
that changes between sessions goes in the brain, not here.

**At end of session, update the brain - not this file:**

- Append a dated entry to the page's `## Timeline` (newest first, each ending with a source link)
- Update `## Compiled truth` only if the state genuinely moved
- Commit the vault

> Superseded 2026-07-26. This previously pointed at four files in `Slav's Vault`, which has been
> archived. Do not write there.

---

## Project Overview

WorldQuiz is a geography quiz web application. Players identify world landmarks from images and pick the right answer from three multiple-choice options. Two roles: regular users (play quizzes, earn star tokens, level up) and admins (manage questions and users).

---

## Repository layout

The project is restructured into a clean tree — app code lives entirely in `src/`:

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
│       ├── wq_db_connect.php  # DB connection
│       ├── csrf.php           # CSRF token helpers
│       ├── display_data.php   # all SELECT queries (prepared statements)
│       ├── delete_data.php    # DELETE queries
│       ├── footer.php         # shared footer partial
│       ├── admin_sidebar.php  # admin navigation partial
│       └── user_sidebar.php   # player navigation partial
├── database/
│   ├── seed.sql                  # CREATE TABLE + 46 question rows
│   └── World Qiuz db code.sql    # original schema scratchpad (kept for reference)
├── graphify-out/          # knowledge-graph output (regenerable; see .graphifyignore)
├── palette-preview.html   # one-off colour-palette comparison page (safe to delete)
├── CLAUDE.md              # this file
├── CLAUDE.local.md        # personal notes; should not be committed
└── .graphifyignore        # only src/ is indexed by graphify
```

---

## Stack

- **Language:** PHP (procedural, no framework)
- **Database:** MySQL (`wq_db`)
- **Frontend:** Vanilla JS, vanilla CSS — no build step
- **Server:** Apache (XAMPP / WAMP) with `.htaccess` rewrite
- **Design system:** Cinematic Dark + Editorial Glass — Playfair Display + Inter via Google Fonts, Boxicons via CDN
- **Build tooling:** none for the app. `worldquiz-tools` package.json is for on-demand asset processing only.

---

## Commands

No build tools or package manager for the app itself.

### Local development

- Requires PHP with MySQLi extension and a MySQL server (XAMPP, WAMP, or similar)
- Point web-server document root at the project root (typically `C:\xampp\htdocs\WorldQuiz\`)
- Access at **`http://localhost/WorldQuiz/`** — root `.htaccess` silently routes every URL into `src/`

### Database setup

- Create database: `wq_db`
- Run `database/seed.sql` to create the `countries` table and seed 46 rows
- `users` and `score` tables are **not** in `seed.sql` — schema is inferred from `src/includes/wq_db_connect.php` and the auth / scoring code. **Open question logged in vault [[STATUS]]:** should `seed.sql` carry the full schema?

### Database credentials

Defaults in `src/includes/wq_db_connect.php`: host `localhost`, user `root`, password `""`, database `wq_db`. Localhost only — see vault `decisions.md` for the production-deployment warning.

---

## Architecture summary

Full architecture detail lives in vault `decisions.md`. Quick reference:

- **No framework.** Each `.php` file is a page or JSON endpoint.
- **AJAX-driven quiz loop:** `get_question.php` → `check_answer.php` → `use_hint.php` → `save_progress.php`
- **Data layer:** `src/includes/display_data.php` (SELECTs) + `src/includes/delete_data.php` (DELETEs). All prepared statements.
- **Auth:** `$_SESSION['user_name']` (players), `$_SESSION['admin_name']` (admins). Session regenerated on login.

### Database tables

| Table | Key columns |
| ------- | ------------- |
| `users` | id, name, email, password, user_type ('admin'\|'user') |
| `score` | id (FK→users), star_tokens, level |
| `countries` | id, country, img_path, **question**, hint, answer1/2/3, is_correct1/2/3 |

Level: `floor(star_tokens / 100) + 1`.

---

## Security Status

All previously known issues are resolved. See vault `decisions.md` for the full list with rationale. Quick summary:

- Passwords hashed; auto-migration of plaintext on first login
- All SQL via prepared statements
- CSRF on every POST endpoint
- `session_regenerate_id(true)` after login
- Admin guards on every admin page
- `$answer_index` whitelisted to 1/2/3 before column-name interpolation

**Do not weaken any of these.**

---

## Graphify

This project has a knowledge graph at `graphify-out/`.

Rules:

- ALWAYS read `graphify-out/GRAPH_REPORT.md` before reading any source files, running grep/glob searches, or answering codebase questions
- IF `graphify-out/wiki/index.md` EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost)
- **The current `graphify-out/` cache is STALE after the `src/` restructure** — regenerate with `/graphify .` when next using the graph

`.graphifyignore` is configured to only index `src/`.
