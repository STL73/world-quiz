# WorldQuiz

A geography quiz web app where players identify world landmarks from photographs and choose the correct answer from three options. Built as a deep-dive into vanilla PHP, MySQLi, and traditional server-rendered web fundamentals before reaching for a framework.

![Landing page](docs/screenshots/landing.png)

> **Status:** local-only. No live demo yet — clone and run with XAMPP per the setup steps below.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Screenshots](#screenshots)
- [Local setup](#local-setup)
- [Database schema](#database-schema)
- [Security highlights](#security-highlights)
- [Project history](#project-history)
- [Known limitations and future work](#known-limitations-and-future-work)
- [License](#license)

---

## Features

**For players**
- Identify 46 landmarks from 14 countries with three-option multiple choice
- Earn star tokens for correct answers — wrong answers cost a token
- Level system derived from token count (`floor(stars / 100) + 1`)
- One hint available per question, costs a token to reveal
- Progress is persisted server-side so the next session resumes where the previous one ended
- Animated feedback overlays show whether the answer was right or wrong

**For admins**
- Add, edit, and delete questions through dedicated forms
- View every registered user and their score totals
- Inspect individual user score histories
- Role-gated dashboards: `user_panel.php` for players, `admin_panel.php` for admins

**Throughout the app**
- Cinematic dark visual design with editorial typography (Playfair Display + Inter)
- Glassmorphism surfaces over saturated landmark photography
- Smooth scrollytelling on the landing page
- Hand-built responsive layout from 320px to 1920px

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Server** | PHP 8 (procedural, no framework) | Wanted to understand request lifecycle, sessions, and templating before reaching for Laravel. Every page is a `.php` file — file-based routing on Apache. |
| **Database** | MySQL 8 via MySQLi | Prepared statements throughout. No ORM — write the SQL, learn the SQL. |
| **Frontend** | Vanilla JavaScript + CSS | No bundler, no framework. Quiz gameplay is AJAX-driven via `fetch()` to small JSON endpoints. |
| **Styling** | Hand-written CSS (~5,000 lines), now split into 7 focused modules | Custom design system with CSS custom properties for tokens, no Tailwind or component library. |
| **Web server** | Apache (via XAMPP) | `.htaccess` rewrites every URL into `src/` so the project root stays tidy while URLs stay clean. |
| **Fonts & icons** | Google Fonts (Playfair Display, Inter) + Boxicons via CDN | No webfont self-hosting yet. |

---

## Architecture

No framework. Procedural PHP with file-based routing — each `.php` file is a page or a JSON endpoint. Shared logic lives in `src/includes/`.

```
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
│   ├── get_question.php   # JSON endpoint
│   ├── check_answer.php   # JSON endpoint
│   ├── save_progress.php  # JSON endpoint
│   ├── use_hint.php       # JSON endpoint
│   ├── CSS/               # design system, 7 module files + aggregator
│   ├── JS/app.js          # all client-side gameplay
│   ├── Images/            # 46 landmark photos organised by country
│   └── includes/
│       ├── wq_db_connect.php  # DB connection
│       ├── csrf.php           # CSRF token helpers
│       ├── display_data.php   # all SELECT queries
│       ├── delete_data.php    # DELETE queries
│       ├── footer.php         # shared footer partial
│       ├── admin_sidebar.php  # admin navigation
│       └── user_sidebar.php   # player navigation
├── database/
│   ├── seed.sql           # CREATE TABLE + 46 question rows
│   └── World Qiuz db code.sql  # original schema scratchpad
└── tools/
    ├── compress-images.js # sharp-based image optimisation
    └── split-css.js       # CSS module split (one-shot)
```

**Authentication flow**
```
login_form.php → sets $_SESSION['user_name'] | $_SESSION['admin_name']
              → redirects to user_panel.php | admin_panel.php
```
Session guards at the top of every protected page check `isset($_SESSION['user_name'])` or `isset($_SESSION['admin_name'])`.

**Quiz gameplay loop (AJAX-driven)**
```
quiz.php (page load)
  ↓
JS/app.js calls get_question.php?id=X
  ↓ returns JSON {question, hint, img_path, answer1/2/3, ...}
user submits → check_answer.php (POST JSON)
  ↓ updates score/level in DB
  ↓ returns next question id
user requests hint → use_hint.php (POST JSON)
user navigates away → save_progress.php (POST JSON)
```

---

## Screenshots

| Landing | Quiz gameplay | User dashboard | Admin panel |
|---|---|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Quiz](docs/screenshots/quiz.png) | ![Dashboard](docs/screenshots/dashboard.png) | ![Admin](docs/screenshots/admin.png) |

> Screenshots pending — capture once deployed or from local development.

---

## Local setup

### Prerequisites

- **XAMPP** (or any LAMP/WAMP stack) with Apache, PHP 8+, and MySQL 8
  - XAMPP install path doesn't matter; this project was developed against `D:\xampp\`
- A web browser

### 1. Clone the repo

```bash
git clone https://github.com/STL73/WorldQuiz.git
```

### 2. Symlink (or copy) into Apache's `htdocs`

Apache must serve files from inside its `htdocs` directory. On Windows with XAMPP, the easiest approach is a symbolic link from `htdocs` to wherever you cloned the repo:

```powershell
# Run PowerShell as Administrator
New-Item -ItemType SymbolicLink -Path "D:\xampp\htdocs\WorldQuiz" -Target "D:\path\to\your\clone\WorldQuiz"
```

Alternatively, clone directly into `htdocs`.

### 3. Enable Apache `mod_rewrite`

The root `.htaccess` rewrites every request into `src/` so URLs stay clean. Ensure `httpd.conf` has:

```apache
LoadModule rewrite_module modules/mod_rewrite.so

<Directory "D:/xampp/htdocs">
    AllowOverride All
</Directory>
```

Restart Apache after enabling.

### 4. Create the database

Open phpMyAdmin (`http://localhost/phpmyadmin/`) or the MySQL CLI:

```sql
CREATE DATABASE wq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wq_db;
```

### 5. Run the question seed

Import `database/seed.sql` — this creates the `countries` table and inserts 46 question rows.

### 6. Create the `users` and `score` tables manually

These tables aren't currently in the seed file. Run the following DDL (inferred from the application code — see [Known limitations](#known-limitations-and-future-work)):

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    user_type ENUM('admin', 'user') NOT NULL DEFAULT 'user'
);

CREATE TABLE score (
    id INT PRIMARY KEY,
    star_tokens INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    current_question_id INT DEFAULT NULL,
    hint_used TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 7. Verify DB credentials

The default credentials in `src/includes/wq_db_connect.php` are the XAMPP defaults (`root` / empty password / `localhost`). Adjust if your MySQL is configured differently. **These are local-only XAMPP defaults — for any deployment, move them to environment variables.**

### 8. Visit the app

Open `http://localhost/WorldQuiz/` in your browser. The `.htaccess` silently routes every URL into `src/` so the URL bar stays clean. Create an account from the landing page; promote yourself to admin by editing the `user_type` column directly in `users` if needed.

---

## Database schema

| Table | Columns | Notes |
|---|---|---|
| `users` | `id`, `name`, `email`, `password`, `user_type` | Passwords are hashed with PHP's `password_hash()` (bcrypt). Email is unique. |
| `score` | `id` (FK → users), `star_tokens`, `level`, `current_question_id`, `hint_used` | One score row per user. Level is recomputed on every token change as `floor(star_tokens / 100) + 1`. |
| `countries` | `id`, `country`, `img_path`, `question`, `hint`, `answer1/2/3`, `is_correct1/2/3` | 46 seeded rows. `is_correctN` flags which answer is the right one. |

---

## Security highlights

Common security pitfalls a beginner PHP project typically falls into — addressed here:

- ✅ **Passwords are hashed** with `password_hash()` / `password_verify()` (bcrypt). Plaintext passwords from earlier development data are migrated to hashes automatically on first successful login.
- ✅ **SQL injection** prevented throughout — every query uses prepared statements with bound parameters. No string concatenation of user input.
- ✅ **CSRF protection** on every state-changing POST endpoint via per-session tokens (`src/includes/csrf.php`).
- ✅ **Session fixation** mitigated — `session_regenerate_id(true)` runs after every successful login.
- ✅ **Admin route guards** — every admin page redirects to the login form if `$_SESSION['admin_name']` is not set.
- ✅ **Column-name injection** prevented in `check_answer.php`: the `$answer_index` parameter is validated to be `1`, `2`, or `3` before being interpolated into the `is_correctN` column name.
- ✅ **XSS** prevented — every output of user-controlled data goes through `htmlspecialchars()`.

What's *not* yet addressed: rate limiting on login attempts, password reset flow, two-factor auth, account lockout after repeated failures.

---

## Project history

A few engineering decisions worth surfacing:

**Project restructure.** Originally every PHP file sat at the project root, mixed in with config, SQL files, images, and tooling. Refactored everything that's actually web-served into `src/`, leaving the root for configuration and documentation. A root-level `.htaccess` uses `mod_rewrite` to silently route every request into `src/` so URLs stay clean for end users.

**Image optimisation.** The 46 landmark photos started at **115 MB** total — some individual photos exceeded 8 MB. Wrote `tools/compress-images.js` (sharp-based) to resize to max 1600px wide and re-encode at JPEG quality 82 with mozjpeg. Result: **14 MB total, an 87.7% reduction**, visually identical at every render size used in the app.

**CSS module split.** `style.css` grew to **4,966 lines** across many design iterations. Split into 7 focused modules in `src/CSS/modules/` (base, responsive, admin, quiz, dashboard, landing, polish) with `style.css` reduced to a thin 19-line aggregator that `@import`s them in source order. Cascade was preserved byte-for-byte — verified mechanically by `tools/split-css.js` before any file was written.

**Security migration.** Earlier dev iterations stored passwords in plaintext. Added a one-time migration path: on successful login with a known-plaintext credential, the password is upgraded to a `password_hash()` before being written back. No data loss, no forced password reset.

---

## Known limitations and future work

Things this project intentionally doesn't have yet, with rough order of how I'd tackle them:

1. **The `users` and `score` tables aren't seeded** — they have to be created manually from the DDL above. Should be folded into `database/seed.sql` or a separate `schema.sql`.
2. **No automated tests.** The PHP code is procedural and global-state-heavy, which makes unit testing painful — a framework migration would be the natural moment to add PHPUnit coverage.
3. **DB credentials are hardcoded.** Acceptable for the local XAMPP context this was built in, but any deployment should read from environment variables.
4. **No deployment yet.** The natural next step is a small VPS or a free PHP-friendly host (Render, fly.io, or a cheap shared host).
5. **Cache-busting after CSS module split.** Editing a module file doesn't update `style.css`'s mtime, so the cache-buster doesn't fire. Either touch `style.css` after every module edit, or refactor the cache-buster to use `max(filemtime)` across all CSS files.
6. **No password reset flow** and **no rate limiting on login**.
7. **Manual admin promotion.** New accounts are always `user_type='user'`; promoting to admin requires editing the database directly. Should at minimum become a script.
8. **Internationalisation.** All UI copy is in English, baked into the templates.

---

## License

MIT — see [LICENSE](LICENSE).
