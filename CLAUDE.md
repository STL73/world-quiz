# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Live memory lives in the Evolving Brain

**Before doing anything in this project, read:**
`C:\Users\slavi\Evolving Brain\Projects\Coding\world-quiz.md`

Its compiled-truth section beats anything in this file. At the end of a session, run `/wrap`:
it updates the brain's Timeline, not this file.

## Project overview

World Quiz is a landmark-guessing quiz: a player sees a photo and picks the right answer from
three. Players earn star tokens and level up; admins manage questions and users.

It is being **rebuilt as a PERN app on the `react-rebuild` branch**. Design:
`docs/superpowers/specs/2026-11-15-react-rebuild-design.md`. Phase plans:
`docs/superpowers/plans/`.

## Folders

```text
world-quiz/
├── backend/    Express 5 API → Drizzle → Neon Postgres
├── frontend/   React 19 + Vite + Tailwind v4
├── src/        the PHP version: behaviour reference only, removed at cutover. Don't edit
├── database/   the PHP version's MySQL schema and seed, the migration source
└── docs/
    ├── learning/            one explanation note per phase
    └── superpowers/         spec and phase plans
```

## Learning comes first

Slav is using this rebuild to learn the stack. Write **one file at a time** and explain it before
the next: what each function or component does, its inputs and outputs, where it's used, and a
walk-through with real data. Save the explanations to `docs/learning/NN-topic.md`. Code comments
stay short (see `code-style.md`).

## Running it

- Backend: `cd backend && npm run dev` → `http://localhost:5600`
- Frontend: `cd frontend && npm run dev` → `http://localhost:5173` (proxies `/api` to the backend)
- Tests: `cd backend && npm test` (Neon `test` branch)
- Migrations: see `.claude/rules/backend.md`. The `dev` and `test` branches both have every
  migration applied
- Accounts start fresh; the PHP users weren't copied. `cd backend && npm run db:seed` creates the
  admin from `SEED_ADMIN_*` in `backend/.env`
- The import from the PHP version: start XAMPP's MySQL, then `cd backend && npm run db:import`
  (`-- --reset` to empty the questions first). Done once on 2026-11-16 into `dev`: 16 countries,
  46 questions. The photos are in Cloudinary under `world-quiz/development/questions/`
- The PHP version: XAMPP on `D:\xampp`, served through the junction `D:\xampp\htdocs\WorldQuiz` at
  `http://localhost/WorldQuiz/`, MySQL database `wq_db`

## Environment variables

`backend/.env`, copied from `backend/.env.example`: `PORT`, `NODE_ENV`, `DB_URL` (Neon `dev`),
`TEST_DB_URL` (Neon `test`), `ARCJET_KEY`, `CLOUDINARY_*`, `SEED_ADMIN_*`, `MYSQL_URL` (the
import; empty for XAMPP's default). Never commit `.env`.

## Rules

- [backend.md](.claude/rules/backend.md)
- [api.md](.claude/rules/api.md)
- [frontend.md](.claude/rules/frontend.md)
- [code-style.md](.claude/rules/code-style.md)
- [testing.md](.claude/rules/testing.md)
- [deployment.md](.claude/rules/deployment.md)

## Security, carried over from the PHP version

Hashed passwords, parameterised queries only, session renewed on login, role checks on admin
routes, validated input. **Do not weaken any of these.**
