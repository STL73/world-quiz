# Phase 0: Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task, inline, with Slav in the loop. Steps use checkbox (`- [ ]`) syntax for
> tracking. Subagent-driven execution is not used: every file is explained to Slav before the next
> one is written.

**Goal:** a clean `react-rebuild` branch with an Express API and a React app that run side by side,
reach a Neon database, pass their first tests, and follow rules written for the new stack.

**Architecture:** two npm packages, `backend/` (Express 5 API on port 5600) and `frontend/` (Vite
React app). In development, Vite forwards `/api` to Express, so the browser sees one address. The
API's first route, `GET /api/v1/health`, proves the whole chain: browser → Vite → Express →
Drizzle → Neon.

**Tech stack:** Node ESM, Express 5, helmet, cookie-parser, Arcjet, Drizzle ORM with
`@neondatabase/serverless`, Vitest + Supertest; React 19, Vite 8, React Router 7, Tailwind CSS v4.
Versions match `D:\MY PROJECTS\manchester-event` on 2026-11-15.

**Spec:** `docs/superpowers/specs/2026-11-15-react-rebuild-design.md`

---

## How every task runs

1. Write one file
2. **Explain it to Slav** (the points are listed in each task): what each function or component
   does, what goes in and comes out, where it is used, a walk-through with a real request, and an
   analogy where it helps. Wait until Slav is ready before the next file
3. After the last step of a task, add that task's explanation to `docs/learning/00-setup.md`
   (Task 10 lists the sections)
4. **Commit only after asking Slav and getting a clear yes.** Every commit step below means: show
   the files, propose the message, ask, wait

Code style: backend uses single quotes and 4-space indents; frontend uses double quotes and 2-space
indents. Comments follow the standard: one plain line above each component and exported function,
and a "why" only when the code can't show it.

## File map

| File | Responsibility |
| --- | --- |
| `backend/package.json` | Backend scripts and dependencies |
| `backend/eslint.config.js` | Lint rules for Node code |
| `backend/vitest.config.js` | Where tests live, setup file, timeouts |
| `backend/.env.example` | Every variable the backend needs, with no values |
| `backend/src/config/env.js` | Reads and re-exports environment variables |
| `backend/src/config/arcjet.js` | The one Arcjet client |
| `backend/src/db/index.js` | The one Drizzle database client |
| `backend/src/lib/errors.js` | `AppError`: an error the client is meant to see |
| `backend/src/middleware/errorHandler.js` | `notFound` and `errorHandler`: every error leaves in one shape |
| `backend/src/middleware/security.js` | `arcjetProtect`, `securityMiddleware` |
| `backend/src/routes/health.routes.js` | `GET /api/v1/health` |
| `backend/src/app.js` | The Express app: middleware order, routers, error handling |
| `backend/src/server.js` | Starts the app on a port |
| `backend/tests/setup.js` | Points tests at the Neon `test` branch |
| `backend/tests/app.test.js` | Error-shape tests |
| `backend/tests/health.test.js` | Health route test |
| `frontend/package.json` | Frontend scripts and dependencies |
| `frontend/eslint.config.js` | Lint rules for React code |
| `frontend/vite.config.js` | React and Tailwind plugins, `/api` proxy |
| `frontend/index.html` | The page shell React mounts into |
| `frontend/src/main.jsx` | Mounts `<App />` inside the router |
| `frontend/src/App.jsx` | Setup-check page (replaced in phase 4) |
| `frontend/src/App.css` | Loads Tailwind |
| `.claude/rules/*.md`, `CLAUDE.md` | Rules for the new stack |
| `docs/learning/00-setup.md` | Phase 0 learning note |

---

### Task 1: Remove the PHP-era tooling

**Files:**

- Delete: `.graphifyignore`, `.graphify_python`, `.graphify_uncached.txt`, `package.json`,
  `package-lock.json`, `node_modules/`, `tools/`, `tests/`, `.claude/agents/`,
  `.claude/commands/`, `.claude/skills/`
- Modify: `.claude/settings.json`, `.gitignore`

- [ ] **Step 1: Show the list and get Slav's explicit approval to delete**

Run: `git ls-files .graphifyignore package.json package-lock.json tools tests .claude/agents .claude/commands .claude/skills`

Show the output and the untracked items (`node_modules/`, `.graphify_python`,
`.graphify_uncached.txt`). Do not delete anything until Slav says yes.

- [ ] **Step 2: Delete the tracked files through git and the untracked ones directly**

```bash
cd "/d/MY PROJECTS/world-quiz"
git rm -r --quiet .graphifyignore package.json package-lock.json tools .claude/agents .claude/commands .claude/skills
rm -rf node_modules tests .graphify_python .graphify_uncached.txt
```

- [ ] **Step 3: Replace `.claude/settings.json` without the graphify hook**

```json
{
  "permissions": {
    "allow": [],
    "deny": []
  },
  "hooks": {},
  "enabledPlugins": {
    "php-lsp@claude-plugins-official": true
  }
}
```

The PHP language server stays until cutover, while `src/` is still read as the reference.

- [ ] **Step 4: Edit `.gitignore`**

Remove these lines from the "Generated / regenerable" group:

```text
graphify-out/
# graphify's local cache files (ast, detect, python, uncached)
.graphify_*
```

Add this group after "Node ecosystem":

```text
# ─── Build output ──────────────────────────────────────────────────────
dist/
```

- [ ] **Step 5: Verify**

Run: `git status --short && ls -a`
Expected: the deletions and the two modified files listed; none of the removed items in `ls`.

- [ ] **Step 6: Explain, then ask to commit**

Explain: why git tracks some files and ignores others, and what `git rm` does differently from
`rm`. Commit message: `chore: remove PHP-era tooling and Claude config`

---

### Task 2: Create the Neon, Arcjet and Cloudinary keys (Slav, in the browser)

Slav creates the accounts and pastes the secrets into `backend/.env` himself, so no secret passes
through the conversation.

- [ ] **Step 1: Neon project**

At console.neon.tech: **New project** → name `world-quiz` → region **AWS Europe (London)** if it is
offered, otherwise the closest European region. The project starts with a `main` branch.

- [ ] **Step 2: Neon branches**

**Branches** → **New branch** → `dev` from `main`. Again → `test` from `main`. For each of `dev`
and `test`, open **Connect** and copy the connection string.

Explain: a Neon branch is a full copy of the database that can be changed without touching the
others, like a git branch for data.

- [ ] **Step 3: Arcjet site**

At app.arcjet.com: **New site** → `world-quiz` → copy the key (`ajkey_...`).

- [ ] **Step 4: Cloudinary**

Use the existing Cloudinary account (the one manchester-event uses). From the dashboard, note the
cloud name, API key and API secret. World Quiz images go in a `world-quiz/` folder, so the two
projects never mix. The keys are first used in phase 1.

---

### Task 3: Backend package and config

**Files:**

- Create: `backend/package.json`, `backend/eslint.config.js`, `backend/.env.example`,
  `backend/src/config/env.js`, `backend/.env` (Slav)

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "world-quiz-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Explain: what `"type": "module"` changes (`import` instead of `require`) and what each script runs.

- [ ] **Step 2: Install the dependencies**

```bash
cd "/d/MY PROJECTS/world-quiz/backend"
npm install express@^5.2.1 helmet@^8.3.0 cookie-parser@^1.4.7 dotenv@^17.4.2 drizzle-orm@^0.45.3 @neondatabase/serverless@^1.2.0 @arcjet/node@^1.14.1
npm install -D vitest@^5.0.5 supertest@^7.3.1 nodemon@^3.1.14 eslint@^10.10.0 @eslint/js@^10.0.1 @eslint/json@^2.1.0 globals@^17.12.0
```

Expected: `added N packages`, no `ERR!`. bcryptjs, Zod, Cloudinary, multer and drizzle-kit are
installed in the phase that first uses them.

Explain: `dependencies` versus `devDependencies`, what `^` means, and what `package-lock.json` is
for.

- [ ] **Step 3: Create `backend/eslint.config.js`**

```js
import js from '@eslint/js';
import globals from 'globals';
import json from '@eslint/json';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    // npm writes an empty "" key into the lockfile, which json/no-empty-keys rejects
    globalIgnores(['package-lock.json']),
    { files: ['**/*.{js,mjs,cjs}'], plugins: { js }, extends: ['js/recommended'], languageOptions: { globals: globals.node } },
    { files: ['**/*.json'], plugins: { json }, language: 'json/json', extends: ['json/recommended'] },
]);
```

- [ ] **Step 4: Create `backend/.env.example`**

```text
# Copy to .env and fill in. .env is never committed
PORT=5600
NODE_ENV=development

# Neon: the dev branch for running the app, the test branch for npm test
DB_URL=
TEST_DB_URL=

# Arcjet. ARCJET_ENV=development locally only
ARCJET_KEY=
ARCJET_ENV=development

# Cloudinary, first used in phase 1
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- [ ] **Step 5: Slav creates `backend/.env`**

Slav copies `.env.example` to `.env` and pastes in the values from Task 2. `DB_URL` is the `dev`
branch string and `TEST_DB_URL` the `test` branch string.

Verify (prints names only, never values): `cd backend && git check-ignore -v .env && grep -o '^[A-Z_]*=.' .env`
Expected: `.gitignore` matches `.env`; `DB_URL=`, `TEST_DB_URL=` and `ARCJET_KEY=` each followed by
a character.

- [ ] **Step 6: Create `backend/src/config/env.js`**

```js
import 'dotenv/config';

// Every setting the app reads, in one place
export const {
    PORT = '5600',
    NODE_ENV = 'development',
    ARCJET_KEY,
} = process.env;
```

Explain: what `.env` and `process.env` are, what `import 'dotenv/config'` does, and destructuring
with defaults.

- [ ] **Step 7: Lint**

Run: `cd backend && npm run lint`
Expected: no output, exit code 0.

- [ ] **Step 8: Ask to commit**

Message: `chore: add the backend package and config`

---

### Task 4: Error handling, test first

**Files:**

- Create: `backend/vitest.config.js`, `backend/tests/setup.js`, `backend/tests/app.test.js`,
  `backend/src/lib/errors.js`, `backend/src/middleware/errorHandler.js`, `backend/src/app.js`

- [ ] **Step 1: Create `backend/vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        setupFiles: ['tests/setup.js'],
        // The Neon test branch sometimes answers slowly; 15 s still shows a hung test
        testTimeout: 15000,
        hookTimeout: 15000,
    },
});
```

- [ ] **Step 2: Create `backend/tests/setup.js`**

```js
import dotenv from 'dotenv';

// Runs before any test file imports the app. Tests use the Neon `test` branch, never the
// development database: dotenv never overwrites a variable that's already set
dotenv.config({ quiet: true });

if (!process.env.TEST_DB_URL) {
    throw new Error('TEST_DB_URL is not defined: tests refuse to run against the development database');
}

process.env.DB_URL = process.env.TEST_DB_URL;
process.env.NODE_ENV = 'test';
```

- [ ] **Step 3: Write the failing tests in `backend/tests/app.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import app from '../src/app.js';
import { AppError } from '../src/lib/errors.js';
import { notFound, errorHandler } from '../src/middleware/errorHandler.js';

// A small app with the real error middleware and routes made to fail on purpose
function makeTestApp() {
    const testApp = express();
    testApp.get('/known-error', () => {
        throw new AppError(409, 'Email already in use');
    });
    testApp.get('/crash', async () => {
        throw new Error('database password is hunter2');
    });
    testApp.use(notFound);
    testApp.use(errorHandler);
    return testApp;
}

describe('error handling', () => {
    it('sends an AppError with its own status and message', async () => {
        const res = await request(makeTestApp()).get('/known-error');
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Email already in use' } });
    });

    it('hides an unexpected error behind a generic 500', async () => {
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await request(makeTestApp()).get('/crash');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: { message: 'Something went wrong' } });
        expect(JSON.stringify(res.body)).not.toContain('hunter2');
        quiet.mockRestore();
    });

    it('answers an unknown address with a 404 in the error shape', async () => {
        const res = await request(app).get('/api/v1/nowhere');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { message: 'Not found: GET /api/v1/nowhere' } });
    });
});
```

- [ ] **Step 4: Run the tests and see them fail**

Run: `cd backend && npm test`
Expected: FAIL, `Failed to load url ../src/app.js` (or `Cannot find module`), because the files
don't exist yet.

Explain: why a test is watched failing before the code is written (it proves the test can fail).

- [ ] **Step 5: Create `backend/src/lib/errors.js`**

```js
// An error the client is meant to see: the error handler sends its status and message as they
// are. Anything else that's thrown becomes a plain 500
export class AppError extends Error {
    constructor(status, message, details) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.details = details;
    }
}
```

Explain: classes, `extends`, `super()`, and why a special error type lets the handler tell safe
messages from dangerous ones.

- [ ] **Step 6: Create `backend/src/middleware/errorHandler.js`**

```js
import { AppError } from '../lib/errors.js';

// A 404 for any address no router answered
export function notFound(req, res, next) {
    next(new AppError(404, `Not found: ${req.method} ${req.originalUrl}`));
}

// Express 5 sends errors thrown in async routes here too, so routes don't need their own
// try/catch. Every error leaves in one shape: { error: { message, details } }
// eslint-disable-next-line no-unused-vars -- Express spots an error handler by its four parameters
export function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        return res.status(err.status).json({
            error: { message: err.message, ...(err.details && { details: err.details }) },
        });
    }

    // express.json()'s own errors (bad JSON, body too large) are safe to show
    if (err.expose && err.status < 500) {
        return res.status(err.status).json({ error: { message: err.message } });
    }

    // Anything unexpected: the details stay in the server log, never in the response
    console.error(err);
    res.status(500).json({ error: { message: 'Something went wrong' } });
}
```

Explain: what middleware is (a queue of functions each request passes through), what `next`
does, and why the four-parameter signature matters.

- [ ] **Step 7: Create `backend/src/app.js`**

```js
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { notFound, errorHandler } from './middleware/errorHandler.js';

// The app without app.listen(), so tests can send it requests without a port
const app = express();

app.use(helmet());
app.use(express.json());
// Fills req.cookies, where the session check will find the session cookie
app.use(cookieParser());

// Both last: notFound catches every address no router answered, and errorHandler catches
// everything thrown above it
app.use(notFound);
app.use(errorHandler);

export default app;
```

- [ ] **Step 8: Run the tests and see them pass**

Run: `cd backend && npm test`
Expected: `Tests  3 passed (3)`.

- [ ] **Step 9: Lint, then ask to commit**

Run: `npm run lint` (expected: no output). Message: `feat: add the error shape and its tests`

---

### Task 5: Database client and health route, test first

**Files:**

- Create: `backend/tests/health.test.js`, `backend/src/db/index.js`,
  `backend/src/routes/health.routes.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Write the failing test in `backend/tests/health.test.js`**

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';

describe('GET /api/v1/health', () => {
    it('reports the API and the database as working', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: { status: 'ok', database: 'ok' } });
    });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd backend && npm test -- health`
Expected: FAIL, `expected 404 to be 200`. The route doesn't exist, so `notFound` answers.

- [ ] **Step 3: Create `backend/src/db/index.js`**

```js
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

if (!process.env.DB_URL) {
    throw new Error('DB_URL is not defined in the environment variables');
}

const sql = neon(process.env.DB_URL);

// The one database client every query goes through
export const db = drizzle({ client: sql });
```

Explain: what an ORM is, what Drizzle adds over raw SQL, why Neon's HTTP driver is used, and why
the file stops the app at start-up if `DB_URL` is missing.

- [ ] **Step 4: Create `backend/src/routes/health.routes.js`**

```js
import { Router } from 'express';
import { sql } from 'drizzle-orm';

import { db } from '../db/index.js';

const healthRouter = Router();

// Answers whether the API is up and can reach the database
healthRouter.get('/', async (req, res) => {
    await db.execute(sql`SELECT 1`);
    res.json({ data: { status: 'ok', database: 'ok' } });
});

export default healthRouter;
```

Explain: routers, `async`/`await`, what happens when Neon is unreachable (the error reaches
`errorHandler` and becomes a 500), and the `{ data }` success shape.

- [ ] **Step 5: Mount the router in `backend/src/app.js`**

Add below the other imports:

```js
import healthRouter from './routes/health.routes.js';
```

Add after `app.use(cookieParser());`:

```js
app.use('/api/v1/health', healthRouter);
```

- [ ] **Step 6: Run all tests and see them pass**

Run: `cd backend && npm test`
Expected: `Tests  4 passed (4)`. This is the first proof that the Neon `test` branch is reachable.

- [ ] **Step 7: Lint, then ask to commit**

Message: `feat: add the database client and health route`

---

### Task 6: Arcjet protection

**Files:**

- Create: `backend/src/config/arcjet.js`, `backend/src/middleware/security.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Create `backend/src/config/arcjet.js`**

```js
import arcjet, { shield, detectBot } from '@arcjet/node';

import { ARCJET_KEY, NODE_ENV } from './env.js';

if (!ARCJET_KEY && NODE_ENV !== 'test') {
    throw new Error('ARCJET_KEY is not defined in the environment variables');
}

// The one Arcjet client, made at start-up; null in tests, which run offline.
// Routes add stricter rules with aj.withRule() at module level, never per request
export const aj = NODE_ENV === 'test' ? null : arcjet({
    key: ARCJET_KEY,
    rules: [
        // Common attacks in the request: SQL injection and the rest of the OWASP Top 10
        shield({ mode: 'LIVE' }),
        // Automated clients, except search engines and link previews (a shared quiz link)
        detectBot({ mode: 'LIVE', allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW'] }),
    ],
});
```

- [ ] **Step 2: Create `backend/src/middleware/security.js`**

```js
import { aj } from '../config/arcjet.js';
import { AppError } from '../lib/errors.js';

// Runs an Arcjet client against the request. securityMiddleware uses the base client on every
// request; a route passes its stricter one from aj.withRule()
export function arcjetProtect(client, props = () => ({})) {
    return async (req, res, next) => {
        if (!client) return next();

        const decision = await client.protect(req, props(req));

        // If Arcjet itself can't be reached, let the request through: an outage of a protection
        // service shouldn't take the whole site down with it
        if (decision.isErrored()) {
            console.warn('Arcjet error:', decision.reason.message);
            return next();
        }

        if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) throw new AppError(429, 'Too many requests, please try again later');
            if (decision.reason.isBot()) throw new AppError(403, 'Automated requests are not allowed');
            throw new AppError(403, 'Request blocked');
        }

        next();
    };
}

export const securityMiddleware = arcjetProtect(aj);
```

Explain: a function that returns a middleware (a factory), what a "decision" is, and "fail open"
versus "fail closed" when the protection service is down.

- [ ] **Step 3: Use it in `backend/src/app.js`**

Add below the other imports:

```js
import { securityMiddleware } from './middleware/security.js';
```

Add directly after `app.use(helmet());`:

```js
// Before the body is parsed: a blocked request costs as little as possible
app.use(securityMiddleware);
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && npm test`
Expected: `Tests  4 passed (4)`. Arcjet is off in tests, so nothing changes.

- [ ] **Step 5: Ask to commit**

Message: `feat: protect every request with Arcjet`

---

### Task 7: Start the server

**Files:**

- Create: `backend/src/server.js`

- [ ] **Step 1: Create `backend/src/server.js`**

```js
import app from './app.js';
import { PORT } from './config/env.js';

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
```

Explain: why `app.js` and `server.js` are separate (tests import `app` without opening a port).

- [ ] **Step 2: Run it**

Run (in the background): `cd backend && npm run dev`
Expected: `Server is running at http://localhost:5600`

- [ ] **Step 3: Check the health route with a browser user agent**

```bash
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36" http://localhost:5600/api/v1/health
```

Expected: `{"data":{"status":"ok","database":"ok"}}`, this time from the `dev` branch.

Plain `curl` with no `-A` is classed as a bot, and Arcjet then blocks every local request for
about a minute, browser included. Seeing that 403 once is a useful check that Arcjet is live, but
do it last.

- [ ] **Step 4: Ask to commit**

Message: `feat: add the server entry point`

---

### Task 8: The React app

**Files:**

- Create: `frontend/package.json`, `frontend/eslint.config.js`, `frontend/vite.config.js`,
  `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/App.css`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "world-quiz-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install the dependencies**

```bash
cd "/d/MY PROJECTS/world-quiz/frontend"
npm install react@^19.2.8 react-dom@^19.2.8 react-router-dom@^7.18.3 tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3
npm install -D vite@^8.3.0 @vitejs/plugin-react@^6.1.1 eslint@^10.10.0 @eslint/js@^10.0.1 eslint-plugin-react-hooks@^7.1.1 eslint-plugin-react-refresh@^0.5.6 globals@^17.12.0
```

Expected: `added N packages`, no `ERR!`. lucide-react is installed in phase 4 with the first icon.

- [ ] **Step 3: Create `frontend/eslint.config.js`**

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
]);
```

- [ ] **Step 4: Create `frontend/vite.config.js`**

```js
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the API answers on the same address as the page, so the browser sends the
    // session cookie with no CORS setup (backend PORT in backend/.env)
    proxy: {
      "/api": "http://localhost:5600",
    },
  },
});
```

Explain: what Vite does (dev server plus build), what a proxy is (like a receptionist forwarding
calls), and why the same address avoids CORS.

- [ ] **Step 5: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>World Quiz</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `frontend/src/App.css`**

```css
@import "tailwindcss";
```

Design tokens arrive in phase 3, once Slav has chosen the look.

- [ ] **Step 7: Create `frontend/src/main.jsx`**

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

Explain: JSX, what "mounting" into `#root` means, what `StrictMode` and `BrowserRouter` wrap
around the app and why.

- [ ] **Step 8: Create `frontend/src/App.jsx`**

```jsx
import { useEffect, useState } from "react";
import "./App.css";

// A setup check: shows whether the browser can reach the API and the database
function App() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    fetch("/api/v1/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body) => setStatus(body.data.database === "ok" ? "ok" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-8 py-6 text-center">
        <h1 className="text-2xl font-semibold">World Quiz</h1>
        <p className="mt-2 text-slate-400">
          API and database:{" "}
          <span className={status === "ok" ? "text-emerald-400" : "text-amber-400"}>{status}</span>
        </p>
      </div>
    </main>
  );
}

export default App;
```

Explain: components, `useState` (a value React remembers and redraws on change), `useEffect` with
`[]` (run once after the first draw), promise chains, Tailwind utility classes, and why the
browser's network tab shows the request twice in development (StrictMode runs effects twice on
purpose to catch bugs).

- [ ] **Step 9: Run both halves and check in the browser**

Backend still running from Task 7. Run (in the background): `cd frontend && npm run dev`
Expected: `Local: http://localhost:5173/`. If manchester-event's frontend already holds 5173, Vite
picks 5174 and says so.

Open the address. Expected: the card reads **API and database: ok** in green. Stop the backend,
reload, and it reads **down** in amber. Start it again.

- [ ] **Step 10: Lint and build**

Run: `cd frontend && npm run lint && npm run build`
Expected: lint prints nothing; the build ends with `✓ built in`. Then `rm -rf dist`.

- [ ] **Step 11: Ask to commit**

Message: `feat: add the React app and its setup check`

---

### Task 9: Rules and CLAUDE.md for the new stack

**Files:**

- Replace: `.claude/rules/api.md`, `backend.md`, `code-style.md`, `deployment.md`, `frontend.md`,
  `testing.md`, and `CLAUDE.md`

Each rule file states only what exists or has been decided. Later phases add their own sections
(the manchester-event pattern). No dates or phase numbers inside the code; the rule files may carry
them.

- [ ] **Step 1: Write `.claude/rules/code-style.md`**

```markdown
# Code Style

There's no Prettier config. Match the file you're in. The two packages differ:

| Convention | `frontend/` | `backend/` |
| --- | --- | --- |
| Quotes | double | single |
| Semicolons | yes | yes |
| Indent | 2 spaces | 4 spaces |
| Trailing commas | yes, multi-line | yes, multi-line |

## Shared conventions

- ES modules everywhere; no CommonJS
- `const` by default; arrow functions for callbacks, `function` declarations for components and
  top-level helpers
- Derive values instead of storing them in extra state
- Immutable updates: spread or `map`/`filter`, never mutate state or props
- No `console.log` left in frontend code. The backend's start-up log in `server.js` is fine
- Lint: ESLint flat config in each package (`eslint.config.js`)

## Comments

- **One line above each component and exported function** saying what it does, in plain words
- **A "why" only when the code can't show it**, at most two lines. Don't narrate what the code does
- **No history in code:** no phase numbers, no dates, no "used to", and no references to the PHP
  version. Decisions live in `.claude/rules/` and git
- **Tests are the exception for length:** a comment explaining how a test forces its situation may
  be as long as it needs

The full teaching for each file lives in `docs/learning/`, not in comments.

## JavaScript, not TypeScript

Plain JS/JSX. No `.ts` files or TS-only syntax. JSDoc only where a type genuinely helps a shared
helper.

## Commits

Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`). Never commit
without asking Slav first.
```

- [ ] **Step 2: Write `.claude/rules/backend.md`**

````markdown
# Backend Rules

## Stack constraints

- Node.js with **ES modules** (`"type": "module"`): always `import`/`export`, and always include the
  `.js` extension in relative imports (`./config/env.js`)
- Express 5
- PostgreSQL on **Neon**, accessed through **Drizzle ORM** (`drizzle-orm/neon-http`,
  `@neondatabase/serverless`). No raw SQL strings in route code; query through `db`
- `dotenv` for config, Zod for validation, Arcjet and `helmet` for security, bcryptjs for passwords,
  Cloudinary and multer for images. Each is installed in the phase that first uses it

## Layout

```text
backend/
├── src/
│   ├── app.js              the Express app: middleware, routers, error handling
│   ├── server.js           imports app and calls listen
│   ├── config/
│   │   ├── env.js          re-exports env vars (PORT, NODE_ENV, ARCJET_KEY)
│   │   └── arcjet.js       the one Arcjet client
│   ├── db/index.js         exports `db` (Drizzle client)
│   ├── lib/errors.js       AppError
│   ├── middleware/         errorHandler (+ notFound), security (arcjetProtect)
│   └── routes/<name>.routes.js
└── tests/                  Vitest + Supertest; setup.js points DB_URL at TEST_DB_URL
```

## Config

- Read env vars through `src/config/env.js`. `db/index.js` reads `process.env.DB_URL` directly and
  throws if it's missing; that fail-fast check is intentional
- `.env` files are gitignored. Never commit one. `backend/.env.example` lists every variable

## Neon branches

`main` is production, `dev` is `DB_URL` locally, `test` is `TEST_DB_URL`.

## Commands

Run from `backend/`: `npm run dev` (nodemon), `npm start`, `npm test`, `npm run lint`.
````

- [ ] **Step 3: Write `.claude/rules/api.md`**

````markdown
# API Rules

## Routing

All routes are versioned under `/api/v1`, one router per resource, mounted in `src/app.js`:

| Mount | File and endpoints |
| --- | --- |
| `/api/v1/health` | `routes/health.routes.js`: `GET /` (API and database check) |

- Router files: `const xRouter = Router();` then `export default xRouter;`
- REST verbs: `GET` list/detail, `POST` create, `PUT` update, `DELETE` remove. Actions that aren't
  CRUD are a sub-path verb (`/questions/:id/hint`)

## Middleware order

In `src/app.js`: `helmet()`, then `securityMiddleware` (Arcjet, before the body is parsed), then
`express.json()`, then `cookieParser()`, then the routers, then `notFound` and `errorHandler`, last.
Middleware registered after a router never runs for that router's routes.

## Responses and errors

```js
{ data: {...} }                                                  // one item
{ data: [...], pagination: { page, limit, total, totalPages } }  // a list
{ error: { message: 'Email already in use', details: [...] } }   // an error
```

- **No try/catch in routes.** Express 5 passes errors from async routes to `errorHandler`. Throw
  `new AppError(status, message, details?)` for anything the client should see; anything else
  becomes a 500 with a generic message, and the real error goes only to the server log
- **Security:** `config/arcjet.js` makes one Arcjet client (shield, bot detection allowing search
  engines and link previews). Stricter rules for a route use `aj.withRule()` at module level, run by
  `arcjetProtect(client, props)`. Rate limit = 429, bot or shield = 403; if Arcjet can't be reached
  the request goes through. Tests skip Arcjet
- **Local testing gotcha:** Arcjet caches a denial for about a minute, and locally every request
  comes from 127.0.0.1. One plain `curl` (classed as a bot) makes every request 403 for that minute,
  browser included. Send a browser user agent with `curl -A`

## Status codes

| Code | When |
| --- | --- |
| 200 | Read or action with a body |
| 201 | Something created |
| 204 | Done, nothing to send |
| 400 | Invalid input |
| 401 | Not logged in, or wrong email or password |
| 403 | Logged in but not allowed, or blocked by Arcjet |
| 404 | Not found |
| 409 | Clashes with what exists (email already in use) |
| 429 | Rate limited |
````

- [ ] **Step 4: Write `.claude/rules/frontend.md`**

````markdown
# Frontend Rules

## Stack constraints

- React 19 with Vite 8, React Router 7, Tailwind CSS v4 through `@tailwindcss/vite`
- Plain JSX, no TypeScript
- Icons: lucide-react only
- No other UI or state libraries without Slav's approval

## Layout

```text
frontend/
├── index.html          page shell; React mounts into #root
├── vite.config.js      React + Tailwind plugins; /api proxied to the backend
└── src/
    ├── main.jsx        mounts <App /> inside StrictMode and BrowserRouter
    ├── App.jsx         setup-check page until the real pages arrive
    └── App.css         @import "tailwindcss"; design tokens go here
```

## Styling

- Tailwind v4 has no config file: design tokens are defined with `@theme` in `App.css`
- The visual direction is chosen in phase 3. Until then, no tokens and no shared classes

## Talking to the API

- Relative URLs only (`/api/v1/...`): Vite proxies them in development, and Express serves the app
  from the same origin in production
- Read `error.message` from failed responses; the API always uses `{ error: { message } }`

## Commands

Run from `frontend/`: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
````

- [ ] **Step 5: Write `.claude/rules/testing.md`**

```markdown
# Testing Rules

## Backend

- **Vitest + Supertest**, `npm test` (once) or `npm run test:watch`, from `backend/`
- Files: `backend/tests/*.test.js`. Supertest sends requests to `src/app.js` directly, with no
  port, which is why `server.js` only calls `listen`
- **Database:** the Neon branch `test` (`TEST_DB_URL`). `tests/setup.js` runs first, points
  `DB_URL` at it and refuses to run without it, so tests never touch the development database
- Arcjet is off in tests (`NODE_ENV=test`)
- Test first: write the test, watch it fail, then write the code
- Each phase adds tests for its endpoints. Outside services (Cloudinary) are never called; tests
  replace them with `vi.mock`

## Frontend

No test runner. Each frontend phase is checked in the browser, and the check is described in the
phase's plan.
```

- [ ] **Step 6: Write `.claude/rules/deployment.md`**

```markdown
# Deployment Rules

No production deployment exists yet. The project runs locally (`npm run dev` in each package).

Planned (spec, phase 5): Railway runs the Express API, which also serves the built React app from
`frontend/dist`, so the site has one origin. Neon `main` is the production database.

When it's deployed, document here:

- The Railway service, its build and start commands, and how to roll back
- Every production environment variable and where it is set
- How migrations run against the production database
- Cookie flags in production (`Secure`, `HttpOnly`, `SameSite`)
```

- [ ] **Step 7: Write `CLAUDE.md`**

````markdown
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
- The PHP version: XAMPP on `D:\xampp`, served through the junction `D:\xampp\htdocs\WorldQuiz` at
  `http://localhost/WorldQuiz/`, MySQL database `wq_db`

## Environment variables

`backend/.env`, copied from `backend/.env.example`: `PORT`, `NODE_ENV`, `DB_URL` (Neon `dev`),
`TEST_DB_URL` (Neon `test`), `ARCJET_KEY`, `ARCJET_ENV`, `CLOUDINARY_*`. Never commit `.env`.

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
````

- [ ] **Step 8: Lint the Markdown**

Run: `npx markdownlint-cli2 "CLAUDE.md" ".claude/rules/*.md"` (if the permission check blocks it,
Slav runs it with `!`)
Expected: `Summary: 0 error(s)`.

- [ ] **Step 9: Ask to commit**

Message: `docs: rewrite CLAUDE.md and the rules for the React rebuild`

---

### Task 10: Phase 0 learning note

**Files:**

- Create: `docs/learning/00-setup.md`

- [ ] **Step 1: Write the note from the explanations given in Tasks 1–9**

Sections, in this order:

1. **The big picture:** a diagram of browser → Vite proxy → Express → Drizzle → Neon, and what
   each layer is for
2. **Neon branches:** `main`, `dev`, `test`, and why tests get their own
3. **The backend, file by file:** `package.json`, `env.js`, `errors.js`, `errorHandler.js`,
   `db/index.js`, `health.routes.js`, `arcjet.js`, `security.js`, `app.js`, `server.js`. For each:
   what it does, its functions with inputs and outputs, and who uses it
4. **One request, traced:** `GET /api/v1/health` from the browser to Neon and back, naming every
   function it passes through, then the same request when Neon is down
5. **The tests:** what Supertest does, why `setup.js` runs first, and why each test was seen to
   fail before it passed
6. **The frontend, file by file:** `vite.config.js`, `index.html`, `main.jsx`, `App.jsx`, `App.css`
7. **Check yourself:** five questions with answers hidden in `<details>` blocks, e.g. "What would
   happen if `express.json()` were moved below the routers?"

- [ ] **Step 2: Lint it**

Run: `npx markdownlint-cli2 "docs/learning/00-setup.md"`
Expected: `Summary: 0 error(s)`.

- [ ] **Step 3: Ask to commit**

Message: `docs: add the phase 0 learning note`

---

## Done when

- `cd backend && npm test` passes 4 tests against the Neon `test` branch
- `npm run lint` is clean in both packages; `npm run build` succeeds in `frontend/`
- The browser shows **API and database: ok** at the Vite address
- The PHP-era tooling is gone, and the rules and `CLAUDE.md` describe the new stack
- `docs/learning/00-setup.md` exists, and Slav has read each part
- Every commit was asked for and approved
- Then run `/wrap` for the brain page's Timeline entry and the handover
