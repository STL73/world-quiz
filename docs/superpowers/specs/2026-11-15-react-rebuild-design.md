# World Quiz: React rebuild design

Date: 2026-11-15. Status: approved in conversation, awaiting review of this written version.

## Goal

Rebuild World Quiz, the landmark-guessing quiz, as a PERN app (Postgres, Express, React, Node)
using the same tools and platforms as `manchester-event`. Give it a new look, add four features,
and deploy it. The rebuild doubles as structured learning: every component and function is
explained as it is written.

The graded original stays untouched in `D:\MY PROJECTS\Old projects\WorldQuizApp\`. The PHP
redesign in `src/` stays in place until the cutover phase.

## Decisions

| Decision | Choice |
| --- | --- |
| Where | This repo, branch `react-rebuild`; PHP `src/` removed at cutover, with approval |
| Shape | Vite React frontend + Express REST API; React never talks to the database |
| Tools | Match `manchester-event` (listed under Stack) |
| Auth | Own auth in Express, the `manchester-event` session pattern |
| Scope | New look **and** four new features, built after the app reaches parity |
| Learning | Every file explained one at a time; notes saved to `docs/learning/` |

## Stack

| Layer | Tools |
| --- | --- |
| Layout | `frontend/` and `backend/`: two npm packages, no workspace. Plain JavaScript, no TypeScript |
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS v4 (tokens in `App.css`, no config file), lucide-react icons |
| Backend | Node ESM, Express 5, Drizzle ORM + drizzle-kit, `@neondatabase/serverless` (`neon-http`), bcryptjs, Zod 4, helmet, cookie-parser, nodemon |
| Security | Arcjet: shield and bot detection on every request, plus a stricter rate limit on login and sign-up |
| Images | Cloudinary for storage, multer to receive uploads |
| Database | Neon Postgres with branches `main` (live), `dev` (building) and `test` (automated tests) |
| Tests | Vitest + Supertest for the API against the Neon `test` branch; frontend checked in the browser each phase |
| Hosting | Railway for Express, which also serves the built React app (one origin), plus Neon. Terms confirmed in the deploy phase |
| Not used | Nodemailer, node-cron, Recharts: World Quiz has no emails, scheduled jobs or charts |

## Architecture

```text
world-quiz/
├── frontend/   React pages and components → calls /api/...
├── backend/    Express API → Drizzle → Neon Postgres
│                          → Cloudinary (images)
├── src/        PHP app, untouched until cutover
├── database/   seed.sql (PHP era) and the MySQL → Postgres migration script
└── docs/
    ├── learning/   one explanation note per phase
    └── superpowers/specs/
```

In development Vite serves the frontend and proxies `/api` to Express. In production Express
serves the built frontend, so cookies need no cross-site setup.

## Data model

| Table | Columns | Notes |
| --- | --- | --- |
| `users` | id, name, email (unique), password_hash, role (`user` / `admin`), created_at | `user_type` becomes a constrained `role` |
| `sessions` | id, user_id (FK, cascade), token_hash, expires_at | Cookie `sid` holds a random token; only its hash is stored |
| `scores` | user_id (PK, FK, cascade), star_tokens (default 10), saved_question_id | Level is **calculated**, `floor(star_tokens / 100) + 1`, never stored |
| `countries` | id, name (unique) | Region, continent and country codes are decided in the world-map design discussion (see New features) |
| `questions` | id, country_id (FK), image_url, cloudinary_id, question, hint, answer1–3, correct_answer (1–3, CHECK) | One column replaces three `is_correct` flags, so exactly one answer is always correct |
| `attempts` | id, user_id, question_id, started_at, answered_at, hint_used, correct, tokens_awarded | Server-side timing, hint state and history |

Phase 1 creates `users`, `scores`, `countries` and `questions`. `sessions` and `attempts` are
created in phase 2, with the code that uses them. Keys are named after their table (`user_id`,
`question_id`), the `manchester-event` convention.

### Migration

A one-off script, `backend/scripts/importFromMysql.js`, copies the 46 questions and 3 users from
MySQL `wq_db` into Neon and uploads the 46 photos to Cloudinary. It lives in `backend/` because it
needs the backend's packages and database client. Existing `$2y$` bcrypt hashes are expected to verify with bcryptjs; a test
proves this before anything relies on it. Success means row counts match and every question's image
loads from Cloudinary.

## Game rules

Parity rules, taken from the PHP code on 2026-11-15:

- Correct answer: +10 star tokens, or +5 if the hint was used. Wrong answer: 0
- One hint per question; the hint costs nothing beyond halving the reward
- Level = `floor(star_tokens / 100) + 1`; new players start with 10 tokens
- The player's current question is saved, so they can continue later. The PHP version keeps it
  only in the session; the rebuild keeps it in `scores.saved_question_id`

**Decision for phase 2:** the PHP version lets a player answer the same question again and earn
tokens again. Using `attempts`, the rebuild can award tokens only for the first correct answer.
This is to be decided when the scoring route is written.

## Security

Kept from the PHP version and not weakened: hashed passwords, parameterised queries only (Drizzle),
session renewed on login, role checks on every admin route, validated input. Cross-site request
protection follows whatever `manchester-event` does, checked when the auth phase starts. New:
Arcjet, helmet headers, Zod validation on every request body, and secrets in `.env` (never
committed) instead of hardcoded database credentials.

## New features

Built only after the parity version is deployed.

1. **Leaderboard:** players ranked by star tokens, with level shown
2. **Play by region:** the player picks a region or country before a round; the server filters.
   Slav's original idea, dropped from the school version for time: the game opens on a world map
   with country borders, and a chosen country fills with its flag's colours. To be designed in its
   own discussion before this phase, which also decides how countries are grouped
3. **Timed rounds:** the server records `started_at` when it sends a question and calculates the
   elapsed time when the answer arrives; the browser countdown is display only. Bonus rules to be
   set in that phase
4. **Image upload for admins:** multer receives the file and Cloudinary stores it; replacing or
   deleting a question also removes its old image

## Learning method

- Code comments follow the `manchester-event` standard: one plain line above each component and
  exported function, and a "why" only when the code can't show it. No phase numbers or dates in code
- Files are written **one at a time**. Each is explained before the next is started: what each
  function or component does, its inputs and outputs, where it is used, and a walk-through with real
  data (e.g. a player answering question 12), with analogies and diagrams where they help
- Each phase ends with how its files connect (e.g. schema → migration → route → hook → component)
- The explanations are saved to `docs/learning/NN-topic.md`, one per phase
- Slav sets the pace and can stop for a deeper dive at any point

## Phases

| # | Phase | Sessions (2–3 h) |
| --- | --- | --- |
| 0 | Branch, `frontend/` and `backend/` skeletons, Neon project and branches, Cloudinary and Arcjet keys, rewrite `.claude/rules/` and `CLAUDE.md` for the new stack | 2–3 |
| 1 | Drizzle schema, migrations, MySQL → Neon migration script, images to Cloudinary | 2–4 |
| 2 | Express API at parity (auth, quiz loop, admin CRUD) with tests | 6–9 |
| 3 | Visual direction: two or three looks as HTML previews; Slav chooses | 1–2 |
| 4 | React frontend at parity | 8–12 |
| 5 | Deploy the parity version to Railway: first live URL | 2–3 |
| 6 | Leaderboard | 1–2 |
| 7 | Play by region | 2–3 |
| 8 | Timed rounds | 2–4 |
| 9 | Admin image upload | 2–3 |
| 10 | Cutover: remove PHP `src/` (with approval), update README and the brain page | 1 |

**Total: 30–45 sessions, about 3–4 months at three sessions a week.** Phases 2 and 4 carry the
most explanation and are the likeliest to overrun.

Every phase finishes with its tests passing (backend) or a browser check (frontend), its learning
note written, and a commit, only after Slav says yes.

## Out of scope

Email (verification, password reset), scheduled jobs, analytics charts, and TypeScript. Any of
these can be added later as its own phase.
