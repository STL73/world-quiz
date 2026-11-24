# Phase 4a: Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task, inline, with Slav in the loop. Steps use checkbox (`- [ ]`) syntax for
> tracking. Subagent-driven execution is not used: every file is explained to Slav before the next
> one is written.

**Goal:** a visitor can sign up or log in, and a player lands on a home screen showing their name,
stars and level, with Play, or Continue and Give up for a saved round, all in the Night explorer
look; the two API changes home needs are proven by tests.

**Architecture:** the backend adds `starTokens` and `level` to every account it sends, and a
read-only `GET /rounds/saved`. The frontend copies `manchester-event`'s pattern: every request goes
through `lib/api.js`, GETs through the `useApi` hook, and the account lives in `useAccount`, called
once in `App.jsx` and passed down as props. Two route guards, `GuestOnly` and `RequireRole`, send
each person to the right page. The design tokens live in `App.css` under `@theme`.

**Tech stack:** React 19, React Router 7, Vite 8, Tailwind CSS v4, lucide-react 1.79.0 (new),
`@fontsource-variable/inter` and `@fontsource-variable/space-grotesk` 5.3.0 (new, approved
2026-11-23). Backend: Express 5, Drizzle on `neon-http`, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-11-23-visual-direction-design.md` (tokens, type, home, log
in, laptop widths, the `/me` change). Phase 4 is split into 4a (this plan), 4b (the play screens)
and 4c (the admin screens), each with its own plan, decided with Slav on 2026-11-24.

---

## Decisions

The first two were Slav's answers on 2026-11-24. The rows marked **new** go further; Slav approved
all nine on 2026-11-24.

| Decision | Choice | Why |
| --- | --- | --- |
| Planning phase 4 | Three plans: 4a foundation, 4b playing, 4c admin, each written when it starts | 8–12 sessions is more than 2a to 2c together; 4b and 4c reuse what 4a settles |
| Screens not previewed | Built to the tokens and checked in the browser at 360px and laptop width | As the spec says. Changes happen in the code |
| **New:** a read-only saved-round route | `GET /rounds/saved` answers `{ roundId, answered, total, tokensEarned }`, or `null` with 200 when there's no round | `GET /rounds/current` marks the next question as shown, which opens it for answering. Home calling it would open a question nobody saw, and later spoil the start time timed rounds need |
| **New:** one account shape | Sign-up, login and `/me` all answer the account with `starTokens` and `level` (`null` for an admin), through one `accountFor(user)` | The frontend stores whatever login answers. Different shapes would leave home without stars until a refresh |
| **New:** the text token is `ink` | `--color-ink: #e8f1ff`, where the spec says `text` | Tailwind would make the class `text-text`. The value is unchanged |
| **New:** the server is the only validator | Forms use `noValidate` and show the server's messages under each field. Hints state the rules before typing (`8 to 72 characters`) | The wording lives in one place, `validation/auth.js`. A second copy in the browser would drift |
| **New:** after login, the guard picks the page | `GuestOnly` sends anyone logged in to their role's start page. No "return to where you were" | With one page per role in 4a there's nowhere else to return to, and navigating from the form as well would race the guard |
| **New:** only a 401 logs the tab out | `refreshAccount` clears the account on a 401 only. A dropped connection keeps the player on home | `manchester-event` treats any failure as logged out, which would throw a player to log in on a flaky phone signal |
| **New:** giving up asks first, in the page | Give up shows "Give up this round? You keep the stars it earned." with Keep it and a coral Give up | A browser `confirm()` can't be styled. Coral marks it as destructive, like Delete |
| **New:** stars to the next level on home | `lib/levels.js` works out the stars into the level and the stars still needed, a mirror of `scoring.js`'s 100 per level | The spec gives home stars and level; the bar costs one line and 4b's summary reuses it |
| **New:** routes 4b and 4c fill | Play and Continue go to `/play`, Give up to `/rounds/:id`, and an admin to `/admin`. Until 4b and 4c build them, those show the not-found page | 4a ends with home complete. Its checks read the network panel to prove the requests ran |
| **New:** same-origin requests | `fetch` without `credentials: "include"` | Vite's proxy in development and Express in production keep one origin, where the browser sends the cookie by default |

Noted for phase 5, not decided here: helmet's default Content Security Policy allows images only
from the app itself, so in production the Cloudinary photos (4b onwards) need `img-src` to allow
`res.cloudinary.com`. Vite's development server doesn't send helmet's headers, so 4a and 4b won't
show it.

Confidence: high on the backend tasks, which reuse the patterns of 2a to 2c. Medium on two
frontend details nothing here has run yet: Tailwind v4 opacity steps outside its defaults
(`bg-white/6`, `border-white/14`; Task 8 checks the built CSS, and the fallback is
`bg-white/[0.06]`), and `max-w-120` as 480px (Task 8; fallback `max-w-[480px]`).

Estimate: 3–4 sessions.

## How every task runs

1. Write one file
2. **Explain it to Slav** (the points are listed in each task): what each function or component
   does, what goes in and comes out, where it's used, a walk-through with real data, and an analogy
   where it helps. Wait until Slav is ready before the next file. In a task with several files,
   every "Write" step ends with **Explain and wait**, so the step list itself enforces this; the
   task's last "Explain" step covers only how its files fit together
3. After the last step of a task, add that task's explanation to
   `docs/learning/05-frontend-foundation.md` (Task 11 lists the sections)
4. **Commit only after asking Slav and getting a clear yes.** Every commit step below means: show
   the files, propose the message, ask, wait. Push is a separate question

Code style: backend single quotes, 4-space indents; frontend double quotes, 2-space indents,
trailing commas. Comments: one plain line above each component and exported function, and a "why"
only when the code can't show it.

Local live checks: send a browser user agent with `curl` (see `api.md`). The browser checks use the
Playwright browser tools, with both servers running:

- Backend: `cd backend && npm run dev` (port 5600)
- Frontend: `cd frontend && npm run dev` (port 5173)

Stop both by process ID afterwards (`Resources/Gotchas.md`: stopping the background task can leave
nodemon holding port 5600).

## File map

| File | Responsibility |
| --- | --- |
| `backend/src/lib/accounts.js` | `accountFor(user)`: the account with stars and level |
| `backend/src/routes/auth.routes.js` | Sign-up, login and `/me` answer `accountFor` |
| `backend/src/lib/rounds.js` | `savedRound(userId)` |
| `backend/src/routes/rounds.routes.js` | `GET /saved` |
| `backend/tests/auth.test.js`, `rounds.test.js` | Added tests |
| `frontend/package.json` | lucide-react and the two font packages |
| `frontend/src/App.css` | The tokens, the page background, the focus ring |
| `frontend/src/main.jsx` | Loads the fonts |
| `frontend/src/lib/api.js` | `api()`, `ApiError`, `fieldErrors()` |
| `frontend/src/hooks/useApi.js` | Reads a GET path, with loading, error and retry |
| `frontend/src/hooks/useAccount.js` | The account and `login`, `signUp`, `logout`, `refreshAccount` |
| `frontend/src/lib/roles.js` | `homeFor(role)` |
| `frontend/src/lib/levels.js` | `levelProgress(starTokens)` |
| `frontend/src/components/Screen.jsx` | The play screens' column |
| `frontend/src/components/Button.jsx` | Primary, quiet and danger buttons |
| `frontend/src/components/FormField.jsx` | A labelled input with its hint or error |
| `frontend/src/components/AuthCard.jsx` | The frame of the log in and sign up forms |
| `frontend/src/components/GuestOnly.jsx` | Log in and sign up only for visitors |
| `frontend/src/components/RequireRole.jsx` | A role's pages only for that role |
| `frontend/src/pages/Login.jsx`, `SignUp.jsx`, `Home.jsx`, `NotFound.jsx` | The pages |
| `frontend/src/App.jsx` | The routes and the shared account |
| `docs/learning/05-frontend-foundation.md` | The learning note |
| `.claude/rules/api.md`, `frontend.md` | Updated for the new route and the frontend's layout |

---

### Task 1: Stars and level on every account

**Files:**

- Modify: `backend/src/lib/accounts.js`
- Modify: `backend/src/routes/auth.routes.js`
- Test: `backend/tests/auth.test.js`

- [ ] **Step 1: Write the failing tests, then explain and wait**

Add at the end of `tests/auth.test.js`, after the `requireRole` describe:

```js
describe('stars and level', () => {
    it('gives a new player 0 stars at level 1, on sign-up and on /me', async () => {
        const { agent, res } = await signUp();
        expect(res.body.data).toMatchObject({ starTokens: 0, level: 1 });

        const me = await agent.get('/api/v1/auth/me');
        expect(me.body.data).toMatchObject({ starTokens: 0, level: 1 });
    });

    it('works the level out from the stars, on /me and at login', async () => {
        const { agent, res, body } = await signUp();
        // 250 stars: two full levels of 100, so level 3
        await db.update(scores).set({ starTokens: 250 }).where(eq(scores.userId, res.body.data.userId));

        const me = await agent.get('/api/v1/auth/me');
        expect(me.body.data).toMatchObject({ starTokens: 250, level: 3 });

        const login = await request(app).post('/api/v1/auth/login').send({ email: body.email, password: PASSWORD });
        expect(login.body.data).toMatchObject({ starTokens: 250, level: 3 });
    });

    it('gives an admin null for both, as admins have no score row', async () => {
        const admin = await addAdmin();
        const agent = request.agent(app);

        const login = await agent.post('/api/v1/auth/login').send({ email: admin.email, password: PASSWORD });
        expect(login.body.data).toMatchObject({ starTokens: null, level: null });

        const me = await agent.get('/api/v1/auth/me');
        expect(me.body.data).toMatchObject({ starTokens: null, level: null });
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run, from `backend/`: `npx vitest run tests/auth.test.js`

Expected: the three new tests FAIL, each on its first `toMatchObject`, because `starTokens` and
`level` are missing. The other tests pass.

- [ ] **Step 3: Add `accountFor`, then explain and wait**

In `src/lib/accounts.js`, add `levelFor` to the imports:

```js
import { levelFor } from './scoring.js';
```

and add after `publicUser`:

```js
// The account the frontend keeps: publicUser plus a player's stars and level. Admins have no
// score row, so both are null
export async function accountFor(user) {
    const [score] = await db.select({ starTokens: scores.starTokens }).from(scores).where(eq(scores.userId, user.userId));
    const starTokens = score?.starTokens ?? null;
    return { ...publicUser(user), starTokens, level: starTokens === null ? null : levelFor(starTokens) };
}
```

- [ ] **Step 4: Answer it from the three routes, then explain and wait**

In `src/routes/auth.routes.js`, change the accounts import to:

```js
import { accountFor, createPlayer } from '../lib/accounts.js';
```

In the sign-up route, replace `res.status(201).json({ data: publicUser(user) });` with:

```js
        res.status(201).json({ data: await accountFor(user) });
```

In the login route, replace `res.json({ data: publicUser(user) });` with:

```js
    res.json({ data: await accountFor(user) });
```

Replace the `/me` route with:

```js
// The logged-in account, which the frontend asks for when it loads
authRouter.get('/me', requireAuth, async (req, res) => {
    res.json({ data: await accountFor(req.user) });
});
```

- [ ] **Step 5: Run the file, then everything**

Run: `npx vitest run tests/auth.test.js`, then `npm test`, then `npm run lint`

Expected: all pass, 148 tests (145 + 3). Lint clean.

- [ ] **Step 6: Explain to Slav**

`accountFor`: why it's a separate step from `publicUser` (the admin player list already joins the
score itself, so `publicUser` stays a plain copy); the `?? null` for an admin; a walk-through with
250 stars reaching level 3. Why sign-up and login answer the same shape as `/me`.

- [ ] **Step 7: Commit (ask Slav first)**

```bash
git add backend/src/lib/accounts.js backend/src/routes/auth.routes.js backend/tests/auth.test.js
git commit -m "feat: send a player's stars and level with their account"
```

---

### Task 2: A saved round, read without opening a question

**Files:**

- Modify: `backend/src/lib/rounds.js`
- Modify: `backend/src/routes/rounds.routes.js`
- Test: `backend/tests/rounds.test.js`

- [ ] **Step 1: Write the failing tests, then explain and wait**

Add to `tests/rounds.test.js`, after the `describe('the current round', ...)` block:

```js
describe('the saved round', () => {
    it('counts the round in play without opening its next question', async () => {
        const player = await newPlayer();
        const start = await player.agent.post(ROUNDS);
        // Answered directly, not through answer(), which would open question 2
        await player.agent.post(ANSWER).send({ choice: await rightChoice(player.userId) });

        const res = await player.agent.get(`${ROUNDS}/saved`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ roundId: start.body.data.roundId, answered: 1, total: 10, tokensEarned: 10 });
        expect((await currentRow(player.userId)).rq.shownAt).toBeNull();
    });

    it('answers null when there is no round in play', async () => {
        const player = await newPlayer();
        const res = await player.agent.get(`${ROUNDS}/saved`);
        expect(res.status).toBe(200);
        expect(res.body.data).toBeNull();
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run, from `backend/`: `npx vitest run tests/rounds.test.js`

Expected: both new tests FAIL with status 400, not 200: `/saved` is read by the `/:id` route,
whose id check refuses `saved`.

- [ ] **Step 3: Add `savedRound`, then explain and wait**

In `src/lib/rounds.js`, add after `currentRound`:

```js
// The round in play as counts, without opening its next question, or null. For the home screen
export async function savedRound(userId) {
    const [round] = await db
        .select({ roundId: rounds.roundId })
        .from(rounds)
        .where(and(eq(rounds.userId, userId), eq(rounds.status, 'active')));
    if (!round) return null;

    const rows = await db.select().from(roundQuestions).where(eq(roundQuestions.roundId, round.roundId));
    const answered = rows.filter((rq) => rq.answeredAt);
    return {
        roundId: round.roundId,
        answered: answered.length,
        total: rows.length,
        tokensEarned: answered.reduce((sum, rq) => sum + rq.tokensAwarded, 0),
    };
}
```

- [ ] **Step 4: Add the route, then explain and wait**

In `src/routes/rounds.routes.js`, add `savedRound` to the import from `../lib/rounds.js`, and add
after the `GET /current` route (it must stay before `/:id`):

```js
// Whether a round is in play, as counts, for the home screen. null when there is none
roundsRouter.get('/saved', async (req, res) => {
    res.json({ data: await savedRound(req.user.userId) });
});
```

- [ ] **Step 5: Run the file, then everything**

Run: `npx vitest run tests/rounds.test.js`, then `npm test`, then `npm run lint`

Expected: all pass, 150 tests. Lint clean.

- [ ] **Step 6: Explain to Slav**

Why home can't use `GET /current` (it records `shown_at`, which is what lets a question be
answered); why `null` with 200 rather than a 404 (no round is a normal answer for home, not an
error); why the route sits above `/:id`, shown by Step 2's 400. Walk-through: one answer right,
`answered: 1, tokensEarned: 10`.

- [ ] **Step 7: Commit (ask Slav first)**

```bash
git add backend/src/lib/rounds.js backend/src/routes/rounds.routes.js backend/tests/rounds.test.js
git commit -m "feat: let home see a saved round without opening its question"
```

---

### Task 3: The look: packages, tokens and fonts

**Files:**

- Modify: `frontend/package.json` (through npm)
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Install the packages**

Run, from `frontend/`:

```bash
npm install lucide-react@1.79.0 @fontsource-variable/inter@5.3.0 @fontsource-variable/space-grotesk@5.3.0
```

Expected: three packages added, no errors.

- [ ] **Step 1b: Rebuild the lockfile from the committed one**

npm 11.5.2 strips the optional platform packages (`@rolldown/binding-*`, `lightningcss-*`) from
the lockfile on any targeted install (`Resources/Gotchas.md`). A lockfile without them breaks Vite
on Windows and installs on Linux hosting. The recorded fix keeps the committed lockfile and adds
only what npm added, deleting nothing.

First count what's at stake: `git show HEAD:frontend/package-lock.json | grep -c '"node_modules/@rolldown/binding-\|"node_modules/lightningcss-'`
and the same `grep -c` on `package-lock.json`. If the counts match, npm stripped nothing: skip to
Step 2.

Otherwise, from `frontend/`, with `<scratchpad>` the session's scratchpad path:

```bash
git show HEAD:frontend/package-lock.json > "<scratchpad>/lock-head.json"
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const head = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const now = JSON.parse(readFileSync('package-lock.json', 'utf8'));
// The committed lockfile, plus the root entry and every package npm added
const packages = { ...head.packages, '': now.packages[''] };
const added = Object.keys(now.packages).filter((key) => !(key in head.packages));
for (const key of added) packages[key] = now.packages[key];
writeFileSync('package-lock.json', JSON.stringify({ ...head, packages }, null, 2) + '\n');
console.log('added', added.length, added.join(' '));
" "<scratchpad>/lock-head.json"
git diff --stat package-lock.json
npm ci
```

Expected: `added` lists the three packages and their dependencies (lucide-react has none, the fonts
none); `git diff --stat` shows insertions only, apart from the root entry's few changed lines;
`npm ci` succeeds. If the diff shows deletions beyond the root entry, stop and show Slav.

- [ ] **Step 2: Write the tokens**

Replace `src/App.css` with:

```css
@import "tailwindcss";

/* Night explorer. Each colour has one meaning: docs/superpowers/specs/2026-11-23-visual-direction-design.md */
@theme {
  --color-bg: #0b1424;
  --color-glow: #173a5e;
  --color-surface: #0f1d33;
  --color-ink: #e8f1ff;
  --color-muted: #8ea3c0;
  --color-teal: #3ee6c4;
  --color-coral: #ff7a59;
  --color-gold: #ffd166;

  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk Variable", ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  body {
    min-height: 100dvh;
    background: var(--color-bg) radial-gradient(circle at 30% 0%, var(--color-glow), var(--color-bg) 60%) fixed;
    color: var(--color-ink);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }

  /* One focus ring everywhere, shown for the keyboard and not for a tap */
  :focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 3: Load the fonts**

In `src/main.jsx`, add after the `react-router-dom` import:

```js
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
```

- [ ] **Step 4: Check it builds and the fonts load**

Run: `npm run build`, then `npm run lint`

Expected: build succeeds and `dist/assets/` holds `.woff2` files for both fonts. Lint clean.

Start the frontend (`npm run dev`), open `http://localhost:5173` in the Playwright browser and
evaluate:

```js
await document.fonts.ready;
[...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family)
```

Expected: the setup-check page on the navy background with its glow, and the list includes
`Inter Variable`. Space Grotesk loads only once a page uses `font-display`, which is Task 8.

- [ ] **Step 5: Explain to Slav**

What `@theme` does in Tailwind v4 (each `--color-*` becomes classes such as `bg-surface`,
`text-teal`, `border-coral/40`); why `ink` and not `text`; why the fonts come from npm and not
Google (helmet's CSP); `:focus-visible` against `:focus`.

- [ ] **Step 6: Commit (ask Slav first)**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/App.css frontend/src/main.jsx
git commit -m "feat: add the Night explorer tokens and self-hosted fonts"
```

---

### Task 4: One way to call the API

**Files:**

- Create: `frontend/src/lib/api.js`

- [ ] **Step 1: Write the file**

```js
// Every call to the backend goes through here. Answers arrive as { data } (a list adds
// { pagination }) or, on failure, { error: { message, details } }, which becomes an ApiError

// A failed request: its status (0 when the server can't be reached), the message to show, and
// for a 400 or 409 the problems by field
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// The server's problems by field, { email: "..." }. Its paths name the part of the request too
// ("body.email"), which a form doesn't need
export function fieldErrors(error) {
  return Object.fromEntries(
    (error?.details ?? []).map(({ path, message }) => [path.replace(/^(body|query|params)\./, ""), message]),
  );
}

// One request to the API. Answers the parsed body, or throws an ApiError
export async function api(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  // Logout answers 204, with no body to read
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.message ?? "Something went wrong. Please try again.",
      payload?.error?.details,
    );
  }
  return payload;
}
```

- [ ] **Step 2: Lint**

Run, from `frontend/`: `npm run lint`

Expected: clean. Nothing imports the file yet; Task 6 does.

- [ ] **Step 3: Explain to Slav**

The three ways a request ends (no connection, a refusal, success) and what each becomes. Walk
through a sign-up with a taken name: the 409 body, then `fieldErrors` turning
`[{ path: "body.name", message }]` into `{ name: "This player name is taken..." }`. Why no
`credentials` option (same origin). Analogy: a post room every letter goes through, so each page
doesn't need to know the address or how to read a returned letter.

- [ ] **Step 4: Commit (ask Slav first)**

```bash
git add frontend/src/lib/api.js
git commit -m "feat: add the frontend's API client"
```

---

### Task 5: Reading a GET path

**Files:**

- Create: `frontend/src/hooks/useApi.js`

- [ ] **Step 1: Write the file**

```js
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

// Reads one GET path (null for none) whenever it changes. The last answer stays while the next
// loads, so a page doesn't flash empty
export function useApi(path) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null, payload: null, error: null });
  const key = path === null ? null : `${attempt}:${path}`;

  useEffect(() => {
    if (path === null) return undefined;
    // Answers can arrive out of order: only the latest request's is kept
    let latest = true;
    api(path).then(
      (payload) => latest && setResult({ key: `${attempt}:${path}`, payload, error: null }),
      (error) => latest && setResult((current) => ({ ...current, key: `${attempt}:${path}`, error })),
    );
    return () => {
      latest = false;
    };
  }, [path, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return {
    payload: result.payload,
    error: result.key === key ? result.error : null,
    loading: key !== null && result.key !== key,
    retry,
  };
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`

Expected: clean.

- [ ] **Step 3: Explain to Slav**

What a hook is; the `key` trick (loading is "the answer I hold isn't for the request I want");
the `latest` flag and the clean-up function, with a picture of two requests finishing out of
order; `retry` bumping `attempt` so the same path is read again. Walk-through: home asks for
`/rounds/saved`, `loading` is true, the answer arrives, `payload.data` is `null`.

- [ ] **Step 4: Commit (ask Slav first)**

```bash
git add frontend/src/hooks/useApi.js
git commit -m "feat: add the useApi hook for reading GET paths"
```

---

### Task 6: The account

**Files:**

- Create: `frontend/src/hooks/useAccount.js`
- Create: `frontend/src/lib/roles.js`

- [ ] **Step 1: Write `lib/roles.js`, then explain and wait**

```js
// The page each role starts on: players play, admins manage
export const homeFor = (role) => (role === "admin" ? "/admin" : "/");
```

- [ ] **Step 2: Write `hooks/useAccount.js`, then explain and wait**

```js
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

// The logged-in account from /auth/me, or null, and the handlers that change it. Each handler
// throws the ApiError for its form to show
export function useAccount() {
  const [account, setAccount] = useState(null);
  // Nothing is shown until /me answers, so a refresh doesn't flash the log in page first
  const [accountLoaded, setAccountLoaded] = useState(false);

  // Only a 401 means logged out. A dropped connection keeps the account the tab already has
  const refreshAccount = useCallback(
    () =>
      api("/auth/me")
        .then(({ data }) => setAccount(data))
        .catch((error) => {
          if (error.status === 401) setAccount(null);
        }),
    [],
  );

  useEffect(() => {
    refreshAccount().finally(() => setAccountLoaded(true));
  }, [refreshAccount]);

  async function login(fields) {
    const { data } = await api("/auth/login", { method: "POST", body: fields });
    setAccount(data);
  }

  async function signUp(fields) {
    const { data } = await api("/auth/sign-up", { method: "POST", body: fields });
    setAccount(data);
  }

  // The tab logs out even if the request fails; the server's session then just expires
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setAccount(null);
  }

  return { account, accountLoaded, refreshAccount, login, signUp, logout };
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`

Expected: clean.

- [ ] **Step 4: Explain to Slav**

Where the account lives (one hook, called once in `App.jsx`, passed down as props) and why the
pages don't each ask `/me`; `accountLoaded` and the flash it prevents; why only a 401 clears the
account; why `refreshAccount` is wrapped in `useCallback` (Home will list it in an effect's
dependencies). Walk-through: a page refresh while logged in, from `account: null, accountLoaded:
false` to the account with `starTokens: 0, level: 1`.

- [ ] **Step 5: Commit (ask Slav first)**

```bash
git add frontend/src/hooks/useAccount.js frontend/src/lib/roles.js
git commit -m "feat: add the useAccount hook and each role's start page"
```

---

### Task 7: Shared pieces: the column, buttons and fields

**Files:**

- Create: `frontend/src/components/Screen.jsx`
- Create: `frontend/src/components/Button.jsx`
- Create: `frontend/src/components/FormField.jsx`

- [ ] **Step 1: Write `components/Screen.jsx`, then explain and wait**

```jsx
// A play screen's column: a phone's full width, and about 480px centred on anything wider
function Screen({ className = "", children }) {
  return <main className={`mx-auto flex min-h-dvh w-full max-w-120 flex-col px-5 py-6 ${className}`}>{children}</main>;
}

export default Screen;
```

- [ ] **Step 2: Write `components/Button.jsx`, then explain and wait**

```jsx
const LOOKS = {
  primary: "bg-teal text-bg hover:brightness-110",
  quiet: "border border-white/14 bg-white/6 text-ink hover:bg-white/10",
  danger: "border border-coral/50 text-coral hover:bg-coral/10",
};

// A button in one of three looks: primary (teal, one per screen), quiet, or danger (coral)
function Button({ look = "primary", type = "button", className = "", ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${LOOKS[look]} ${className}`}
      {...props}
    />
  );
}

export default Button;
```

- [ ] **Step 3: Write `components/FormField.jsx`, then explain and wait**

```jsx
import { useId } from "react";

// A labelled input with a hint, or the server's message for it, read out with the field
function FormField({ label, hint, error, ...inputProps }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className="min-h-12 rounded-xl border border-white/14 bg-white/6 px-4 text-[15px] text-ink aria-invalid:border-coral"
        {...inputProps}
      />
      {note && (
        <p id={noteId} className={`text-sm ${error ? "text-coral" : "text-muted"}`}>
          {note}
        </p>
      )}
    </div>
  );
}

export default FormField;
```

- [ ] **Step 4: Lint**

Run: `npm run lint`

Expected: clean. Tailwind only builds the classes a page uses, so whether `max-w-120`,
`bg-white/6` and `border-white/14` work is checked in Task 8 Step 6, the first task with a page.

- [ ] **Step 5: Explain to Slav**

Props and `...rest` (everything not named goes on to the element, so `<Button onClick disabled>`
works); why `type="button"` is the default (a button inside a form submits it otherwise);
`useId` and why the label, input and message are linked by id (a screen reader reads the message
with the field); `aria-invalid` doing double duty as the coral border's trigger.

- [ ] **Step 7: Commit (ask Slav first)**

```bash
git add frontend/src/components/Screen.jsx frontend/src/components/Button.jsx frontend/src/components/FormField.jsx
git commit -m "feat: add the column, button and form field components"
```

---

### Task 8: Log in and sign up

**Files:**

- Create: `frontend/src/components/AuthCard.jsx`
- Create: `frontend/src/components/GuestOnly.jsx`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/pages/SignUp.jsx`
- Create: `frontend/src/pages/NotFound.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Write `components/AuthCard.jsx`, then explain and wait**

```jsx
import Screen from "./Screen.jsx";

// The frame of the log in and sign up forms: a title, one centred panel, and a line under it
function AuthCard({ title, footer, children }) {
  return (
    <Screen className="justify-center">
      <p className="text-center font-display text-sm font-bold uppercase tracking-[0.2em] text-teal">World Quiz</p>
      <h1 className="mt-2 text-center font-display text-[26px] font-bold">{title}</h1>
      <div className="mt-6 rounded-3xl border border-white/10 bg-surface p-5 shadow-[0_10px_30px_rgba(0,0,0,.45)]">
        {children}
      </div>
      <p className="mt-5 text-center text-sm text-muted">{footer}</p>
    </Screen>
  );
}

export default AuthCard;
```

- [ ] **Step 2: Write `components/GuestOnly.jsx`, then explain and wait**

```jsx
import { Navigate, Outlet } from "react-router-dom";
import { homeFor } from "../lib/roles.js";

// Log in and sign up are for visitors. Someone logged in goes to their start page, which is also
// how a successful login leaves the form
function GuestOnly({ account }) {
  return account ? <Navigate to={homeFor(account.role)} replace /> : <Outlet />;
}

export default GuestOnly;
```

- [ ] **Step 3: Write `pages/Login.jsx`, then explain and wait**

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/AuthCard.jsx";
import Button from "../components/Button.jsx";
import FormField from "../components/FormField.jsx";
import { fieldErrors } from "../lib/api.js";

// Logs a player or an admin in. Once the account arrives, GuestOnly moves them on
function Login({ login }) {
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await login({ email: form.get("email"), password: form.get("password") });
    } catch (error) {
      setErrors(fieldErrors(error));
      // A wrong password, a rate limit or a lost connection belongs to no one field
      if (!error.details) setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Log in"
      footer={
        <>
          New here?{" "}
          <Link to="/sign-up" className="font-semibold text-teal">
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {message && (
          <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
            {message}
          </p>
        )}
        <FormField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
        <FormField label="Password" name="password" type="password" autoComplete="current-password" error={errors.password} />
        <Button type="submit" disabled={busy} className="mt-2">
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default Login;
```

- [ ] **Step 4: Write `pages/SignUp.jsx`, then explain and wait**

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/AuthCard.jsx";
import Button from "../components/Button.jsx";
import FormField from "../components/FormField.jsx";
import { fieldErrors } from "../lib/api.js";

// Makes a player account and logs it in. Once the account arrives, GuestOnly moves them on
function SignUp({ signUp }) {
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await signUp({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
    } catch (error) {
      setErrors(fieldErrors(error));
      // Too many sign-ups or a lost connection belongs to no one field
      if (!error.details) setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Create an account"
      footer={
        <>
          Already playing?{" "}
          <Link to="/login" className="font-semibold text-teal">
            Log in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {message && (
          <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
            {message}
          </p>
        )}
        <FormField
          label="Player name"
          name="name"
          autoComplete="nickname"
          hint="3 to 20 characters. Other players will see it."
          error={errors.name}
        />
        <FormField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="8 to 72 characters."
          error={errors.password}
        />
        <Button type="submit" disabled={busy} className="mt-2">
          {busy ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default SignUp;
```

- [ ] **Step 5: Write `pages/NotFound.jsx` and the routes, then explain and wait**

`pages/NotFound.jsx`:

```jsx
import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";

// Any address the app doesn't have
function NotFound() {
  return (
    <Screen className="justify-center text-center">
      <p className="font-display text-[52px] font-bold text-teal">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold">This page isn't on the map</h1>
      <p className="mt-2 text-muted">The address may be mistyped, or the page has moved.</p>
      <Link to="/" className="mt-6 font-semibold text-teal">
        Back to the start
      </Link>
    </Screen>
  );
}

export default NotFound;
```

Replace `src/App.jsx` with:

```jsx
import { Route, Routes } from "react-router-dom";
import GuestOnly from "./components/GuestOnly.jsx";
import { useAccount } from "./hooks/useAccount.js";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import SignUp from "./pages/SignUp.jsx";
import "./App.css";

// The pages, and the account they share
function App() {
  const { account, accountLoaded, login, signUp } = useAccount();

  // Until /me answers, it isn't known who is logged in, so no page can be chosen
  if (!accountLoaded) return null;

  return (
    <Routes>
      <Route element={<GuestOnly account={account} />}>
        <Route path="/login" element={<Login login={login} />} />
        <Route path="/sign-up" element={<SignUp signUp={signUp} />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
```

- [ ] **Step 6: Build, lint, and check the classes exist**

Run: `npm run build`, `npm run lint`, then search the built CSS for the three classes that rely on
Tailwind v4 accepting any step (the CSS escapes the slash as `\/`):

```bash
grep -ohF -e 'max-w-120' -e 'bg-white\/6' -e 'border-white\/14' dist/assets/*.css | sort -u
```

Expected: build and lint clean; the grep lists all three. If one is missing, use the fallbacks in
the plan's confidence note.

- [ ] **Step 7: Check it in the browser**

Start both servers. In the Playwright browser at 360 × 640:

1. `http://localhost:5173/login`: the form centred on the navy glow, Space Grotesk on the title,
   no horizontal scroll (`document.documentElement.scrollWidth === 360`)
2. Log in with `nobody@outlook.com` and `wrong-password`: the coral box says "Email or password is
   incorrect"
3. Submit the empty form: messages under Email and Password, each field's border coral
4. Tab through the form: the teal focus ring on each field and the button
5. Sign up with name `ab`, email `wq-check-<stamp>@mailinator.com`, password `short`: messages under
   all three (Arcjet runs after validation, so the email message is the format or the disposable
   refusal, whichever Arcjet reaches)
6. Sign up with name `Check<stamp>`, `wq-check-<stamp>@outlook.com`, password
   `live-check-password`: the page moves to `/`, which shows the not-found page until Task 9.
   Network panel: `POST /api/v1/auth/sign-up` 201 with `starTokens: 0, level: 1`
7. Reload `/login`: it moves to `/` again (logged in, so GuestOnly sends the visitor on)
8. Resize to 1280 × 800: the form stays about 480px wide, centred

Screenshot steps 1, 3 and 8 into the scratchpad. Show them to Slav.

The account from step 6 is reused in Task 9 and deleted in Task 10.

- [ ] **Step 8: Explain to Slav**

`<Outlet />` and nested routes (GuestOnly wraps two pages); why a successful login doesn't
navigate itself; `FormData` reading the form without one `useState` per field; why `noValidate`;
the two kinds of failure, by field and general, with the step 2 and step 3 checks as examples.

- [ ] **Step 9: Commit (ask Slav first)**

```bash
git add frontend/src/components/AuthCard.jsx frontend/src/components/GuestOnly.jsx frontend/src/pages/Login.jsx frontend/src/pages/SignUp.jsx frontend/src/pages/NotFound.jsx frontend/src/App.jsx
git commit -m "feat: add the log in and sign up pages"
```

---

### Task 9: Home

**Files:**

- Create: `frontend/src/lib/levels.js`
- Create: `frontend/src/components/RequireRole.jsx`
- Create: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Write `lib/levels.js`, then explain and wait**

```js
// The same rule as the backend's scoring.js: every 100 stars is a level
const STARS_PER_LEVEL = 100;

// How far a player is through their level: the stars still needed and the share done, 0 to 100
export function levelProgress(starTokens) {
  const into = starTokens % STARS_PER_LEVEL;
  return { needed: STARS_PER_LEVEL - into, percent: (into / STARS_PER_LEVEL) * 100 };
}
```

- [ ] **Step 2: Write `components/RequireRole.jsx`, then explain and wait**

```jsx
import { Navigate, Outlet } from "react-router-dom";
import { homeFor } from "../lib/roles.js";

// Shows its pages only to one role: a visitor goes to log in, the other role to its own start
// page. The API checks the role again on every request
function RequireRole({ account, role }) {
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== role) return <Navigate to={homeFor(account.role)} replace />;
  return <Outlet />;
}

export default RequireRole;
```

- [ ] **Step 3: Write `pages/Home.jsx`, then explain and wait**

```jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Star } from "lucide-react";
import Button from "../components/Button.jsx";
import Screen from "../components/Screen.jsx";
import { useApi } from "../hooks/useApi.js";
import { api } from "../lib/api.js";
import { levelProgress } from "../lib/levels.js";

// The player's start page: their stars and level, and Play, or Continue and Give up for a saved round
function Home({ account, refreshAccount, logout }) {
  const navigate = useNavigate();
  const saved = useApi("/rounds/saved");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const { needed, percent } = levelProgress(account.starTokens);
  // undefined while loading or after a failure; null when no round is in play
  const round = saved.loading || saved.error ? undefined : saved.payload.data;

  // A round changes the stars, so they are read again whenever Home opens
  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  // Runs one button's request. On failure its message shows and the saved round is read again
  async function run(request) {
    setBusy(true);
    setMessage(null);
    try {
      await request();
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
      setConfirming(false);
      saved.retry();
    }
  }

  const play = () =>
    run(async () => {
      await api("/rounds", { method: "POST" });
      navigate("/play");
    });

  const giveUp = () =>
    run(async () => {
      const { data } = await api("/rounds/current/abandon", { method: "POST" });
      navigate(`/rounds/${data.roundId}`);
    });

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-teal">World Quiz</p>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:text-ink"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </button>
      </header>

      <section className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Explorer</p>
        <h1 className="mt-1 break-words font-display text-[26px] font-bold">{account.name}</h1>

        <div className="mt-6 rounded-3xl border border-white/10 bg-surface p-5">
          <div className="flex items-end justify-between">
            <p className="flex items-center gap-2 font-display text-[40px] font-bold leading-none text-teal">
              <Star className="size-7 fill-teal" aria-hidden="true" />
              {account.starTokens}
              <span className="sr-only">stars</span>
            </p>
            <p className="font-display text-sm font-bold">Level {account.level}</p>
          </div>
          <div
            role="progressbar"
            aria-label={`Progress to level ${account.level + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
          >
            <div className="h-full rounded-full bg-teal" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {needed} stars to level {account.level + 1}
          </p>
        </div>
      </section>

      <section className="mt-auto pt-10">
        {message && (
          <p role="alert" className="mb-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
            {message}
          </p>
        )}

        {saved.loading && <p className="text-center text-sm text-muted">Looking for a saved round…</p>}

        {saved.error && (
          <div className="text-center">
            <p className="text-sm text-muted">{saved.error.message}</p>
            <Button look="quiet" onClick={saved.retry} className="mt-3">
              Try again
            </Button>
          </div>
        )}

        {round === null && (
          <Button onClick={play} disabled={busy} className="w-full text-lg">
            Play
          </Button>
        )}

        {round && (
          <div className="rounded-3xl border border-white/10 bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Round in play</p>
            <p className="mt-1 font-display text-lg font-bold">
              {round.answered} of {round.total} answered ·{" "}
              <span className="text-teal">{round.tokensEarned} stars</span> so far
            </p>
            {confirming ? (
              <>
                <p className="mt-4 text-sm">Give up this round? You keep the stars it earned.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Button look="quiet" onClick={() => setConfirming(false)} disabled={busy}>
                    Keep it
                  </Button>
                  <Button look="danger" onClick={giveUp} disabled={busy}>
                    Give up
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
                <Button onClick={() => navigate("/play")} disabled={busy}>
                  Continue
                </Button>
                <Button look="quiet" onClick={() => setConfirming(true)} disabled={busy}>
                  Give up
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </Screen>
  );
}

export default Home;
```

- [ ] **Step 4: Add the route, then explain and wait**

In `src/App.jsx`, add the imports:

```jsx
import RequireRole from "./components/RequireRole.jsx";
import Home from "./pages/Home.jsx";
```

take `refreshAccount` and `logout` from the hook as well:

```jsx
  const { account, accountLoaded, refreshAccount, login, signUp, logout } = useAccount();
```

and add inside `<Routes>`, before the `*` route:

```jsx
      <Route element={<RequireRole account={account} role="user" />}>
        <Route path="/" element={<Home account={account} refreshAccount={refreshAccount} logout={logout} />} />
      </Route>
```

- [ ] **Step 5: Build and lint**

Run: `npm run build`, then `npm run lint`

Expected: both clean.

- [ ] **Step 6: Check it in the browser**

Both servers running, the Playwright browser at 360 × 640, logged in as Task 8's account:

1. `/`: the name, `0` stars in teal, `Level 1`, an empty bar, "100 stars to level 2", and Play at
   the bottom. Network panel: `GET /rounds/saved` 200 with `data: null`, and no `GET
   /rounds/current`
2. Play: `POST /rounds` 201, then `/play` shows the not-found page (4b builds it)
3. Back to `/`: "Round in play, 0 of 10 answered · 0 stars so far", Continue and Give up. Network:
   `GET /rounds/saved` only
4. Give up, then Keep it: back to Continue and Give up, nothing sent
5. Give up, then Give up: `POST /rounds/current/abandon` 200, then `/rounds/<id>` shows the
   not-found page (4b builds it). Back to `/`: Play again
6. On `/`, stop the backend and press Play: the coral box shows the failure (Vite's proxy answers
   502, so "Something went wrong. Please try again.") and the account stays on screen, because
   only a 401 logs the tab out
7. With the backend still stopped, reload `/`: `/me` fails with 502, no account is known, so the
   log in page shows. Start the backend again and reload: home is back, still logged in
8. Log out: `/login`. Then visit `/`: sent to `/login`
9. Log in as the admin (password from `backend/.env`, `SEED_ADMIN_*`, read by the script, never
   typed into the chat): sent to `/admin`, the not-found page (4c builds it). Visit `/`: sent back
   to `/admin`
10. At 1280 × 800 as the player: the column about 480px wide, centred, Play at the bottom of the
    column
11. The longest name, 20 characters: at 360px, set it in the browser with
    `document.querySelector("h1").textContent = "Wwwwwwwwwwwwwwwwwwww"` (W is the widest letter).
    It fits or wraps, and `document.documentElement.scrollWidth` stays 360

Screenshot steps 1, 3, 5's confirm state and 10 into the scratchpad. Show them to Slav.

- [ ] **Step 7: Explain to Slav**

`RequireRole` and why hiding a page isn't security (the API's `requireRole` is); the four states
of the round section (loading, failed, none, saved) and how `round` tells them apart with
`undefined` and `null`; `run()` wrapping each button; why `refreshAccount` runs on open; the
progress bar's `aria-*` attributes. Walk-through: a player with 140 stars sees level 2, "60 stars
to level 3", the bar 40% full.

- [ ] **Step 8: Commit (ask Slav first)**

```bash
git add frontend/src/lib/levels.js frontend/src/components/RequireRole.jsx frontend/src/pages/Home.jsx frontend/src/App.jsx
git commit -m "feat: add the player's home screen"
```

---

### Task 10: Remove the check account and stop the servers

- [ ] **Step 1: Stop both servers**

Stop Vite and nodemon by process ID. Check ports 5173 and 5600 are free.

- [ ] **Step 2: Remove the live-check account (ask Slav first)**

**Ask Slav before deleting.** Then, from `backend/`:

```bash
node --input-type=module -e "const { like } = await import('drizzle-orm'); const { db } = await import('./src/db/index.js'); const { users } = await import('./src/db/schema/index.js'); console.log(await db.delete(users).where(like(users.email, 'wq-check-%')).returning({ email: users.email }))"
```

Expected: Task 8's one email listed (the mailinator sign-up was refused, so it made nothing). Its
score, sessions and rounds go with it (cascade). `dev` is back to the admin only.

---

### Task 11: The learning note and the rules

**Files:**

- Create: `docs/learning/05-frontend-foundation.md`
- Modify: `.claude/rules/api.md`
- Modify: `.claude/rules/frontend.md`
- Modify: `docs/superpowers/specs/2026-11-17-core-game-design.md` (the phase table)

- [ ] **Step 1: Finish the learning note**

`docs/learning/05-frontend-foundation.md` has had each task's explanation added as it went. Check
it holds these sections, in this order, and add what's missing:

1. What 4a builds, and how 4b and 4c continue it
2. The two API changes: `accountFor`, and `GET /rounds/saved` with why `GET /current` couldn't do
3. The look: `@theme`, the tokens and their meanings, the fonts
4. `lib/api.js`: one request, three endings
5. `useApi` and `useAccount`: hooks, state, effects and the out-of-order answer
6. The shared components: props, `...rest`, `useId`
7. Routing: `Routes`, nested routes, `Outlet`, `GuestOnly` and `RequireRole`
8. Log in and sign up: `FormData`, the two kinds of error
9. Home: the four states of the round section, `run()`, the progress bar
10. How it connects: one trace from pressing Log in to home showing the stars, through the form,
    `useAccount`, `api()`, Vite's proxy, the Express route, `accountFor`, the database, and back
    through `GuestOnly` to `Home`
11. Five check-yourself questions, answers at the end

Run: `markdownlint-cli2 docs/learning/05-frontend-foundation.md`. Expected: no errors.

- [ ] **Step 2: Update `api.md`**

In the routing table, the rounds row: add `GET /saved` after `GET /current`. In the **Auth** bullet,
add: "Sign-up, login and `/me` answer the account with `starTokens` and `level`, both `null` for an
admin (`accountFor`)." In the **Play routes** bullet, add: "`GET /saved` says whether a round is in
play without opening a question, for the home screen; `GET /current` opens it."

- [ ] **Step 3: Update `frontend.md`**

Replace the **Layout** tree with:

```text
frontend/
├── index.html            page shell; React mounts into #root
├── vite.config.js        React + Tailwind plugins; /api proxied to the backend
└── src/
    ├── main.jsx          mounts <App /> inside StrictMode and BrowserRouter; loads the fonts
    ├── App.jsx           the routes and the account they share
    ├── App.css           @import "tailwindcss"; the tokens under @theme
    ├── lib/              api.js (api, ApiError, fieldErrors), roles.js, levels.js
    ├── hooks/            useApi.js, useAccount.js
    ├── components/       Screen, Button, FormField, AuthCard, GuestOnly, RequireRole
    └── pages/            Login, SignUp, Home, NotFound
```

Replace the **Styling** section's two bullets with:

- Tailwind v4 has no config file: the tokens are `@theme` in `App.css`, from
  `docs/superpowers/specs/2026-11-23-visual-direction-design.md`. Each colour has one meaning:
  teal right and the main action, coral wrong and destructive, gold the streak and level up.
  The text colour is `ink`
- Space Grotesk (`font-display`) for headings and figures, Inter (the default) for the rest,
  both from `@fontsource-variable`
- Play screens sit in `Screen`, a column about 480px wide on anything wider than a phone

Add to **Talking to the API**: "Every request goes through `api()` in `lib/api.js`; GETs a page
shows go through `useApi`. The account lives in `useAccount`, called once in `App.jsx`."

- [ ] **Step 4: Update the phase table**

In `docs/superpowers/specs/2026-11-17-core-game-design.md`, replace the phase 4 row with:

```markdown
| 4a | React frontend: foundation, log in, sign up, home | 3–4 |
| 4b | React frontend: the question, result and round summary | 3–4 |
| 4c | React frontend: the admin screens | 2–4 |
```

and add under the paragraph about admin image upload: "Phase 4 was split into 4a to 4c on
2026-11-24, each with its own plan (`2026-11-24-phase-4a-frontend-foundation.md`)."

- [ ] **Step 5: Lint the changed markdown**

Run: `markdownlint-cli2 .claude/rules/api.md .claude/rules/frontend.md docs/superpowers/specs/2026-11-17-core-game-design.md`

Expected: no errors.

- [ ] **Step 6: Commit (ask Slav first)**

```bash
git add docs/learning/05-frontend-foundation.md .claude/rules/api.md .claude/rules/frontend.md docs/superpowers/specs/2026-11-17-core-game-design.md
git commit -m "docs: add the phase 4a rules and learning note"
```

---

## Done when

- 150 backend tests pass and both packages lint clean; `npm run build` succeeds
- The Task 8 and Task 9 browser checks pass at 360px and 1280px, with screenshots Slav has seen
- No `GET /rounds/current` is sent by home, shown in the network panel
- The check account is removed from `dev`
- `docs/learning/05-frontend-foundation.md` is written, and the rules describe the new route and
  the frontend's layout
- Every commit was made on Slav's yes
