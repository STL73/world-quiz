# Phase 2a: Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task, inline, with Slav in the loop. Steps use checkbox (`- [ ]`) syntax for
> tracking. Subagent-driven execution is not used: every file is explained to Slav before the next
> one is written.

**Goal:** players can sign up, log in, stay logged in and log out; every account has a unique
player name; admin-only and player-only routes can be guarded; and tests prove all of it.

**Architecture:** the `manchester-event` session pattern. A random token goes in an `httpOnly`,
`SameSite=Lax` cookie called `sid`; only its SHA-256 hash is stored, in a new `sessions` table.
`requireAuth` loads the user from the cookie onto `req.user`, and `requireRole` checks the role.
Sign-up creates the user and their `scores` row in one `db.batch()`, which is one transaction.
Zod checks every request body through a `validate` middleware.

**Tech stack:** Express 5, Drizzle ORM 0.45 on `neon-http`, Zod 4.6.7 (new in this phase, the
version `manchester-event` uses), bcryptjs, Arcjet (`protectSignup`, `slidingWindow`), Vitest +
Supertest.

**Specs:** `docs/superpowers/specs/2026-11-15-react-rebuild-design.md` (Security) and
`docs/superpowers/specs/2026-11-17-core-game-design.md` (phase table, starting tokens).

---

## Decisions taken while planning (2026-11-17)

| Decision | Choice | Why |
| --- | --- | --- |
| Password rules | 8 to 72 characters, nothing else | `manchester-event`'s rule. Length beats composition rules; 72 is bcrypt's limit. Slav's 8-character admin password stays (Slav) |
| Player names | Unique whatever the capitals, 3 to 20 characters | The leaderboard shows them. Cheapest to decide before any players exist. The admin's name is 4 characters, checked in `dev` (Slav) |
| Session pattern | Copied from `manchester-event`: 30 days, renewed with under 15 left, a new session at every login | One pattern across both apps. A new session at login keeps the PHP version's "session renewed on login" |
| Cross-site protection | `SameSite=Lax` cookie and one origin; no CSRF tokens | What `manchester-event` does, as the rebuild spec requires |
| Sign-up | Logs in straight away; creates the `scores` row in the same batch | There is never a player without a score row. The admin has none, since admins don't play |
| Starting tokens | `scores.star_tokens` defaults to 0 in this phase, not 2b | Sign-up is where the row is made. `saved_question_id` is still dropped in 2b, with the rounds |
| Left out | Email verification, password reset, change password, suspension, system logs | World Quiz sends no email (spec: out of scope). Admin user management is phase 2c |

## How every task runs

1. Write one file
2. **Explain it to Slav** (the points are listed in each task): what each function does, what goes
   in and comes out, where it's used, a walk-through with real data, and an analogy where it helps.
   Wait until Slav is ready before the next file
3. After the last step of a task, add that task's explanation to `docs/learning/02-auth.md`
   (Task 9 lists the sections)
4. **Commit only after asking Slav and getting a clear yes.** Every commit step below means: show
   the files, propose the message, ask, wait. Push is a separate question

Code style: backend uses single quotes and 4-space indents. Comments follow the standard: one plain
line above each exported function or table, and a "why" only when the code can't show it.

Local live checks: send a browser user agent with `curl -A` (see `api.md`): a plain `curl` is
classed as a bot and Arcjet then blocks every request for about a minute, browser included.

## File map

| File | Responsibility |
| --- | --- |
| `backend/package.json` | Adds `zod` |
| `backend/src/db/schema/users.js` | `users.name` becomes 3–20 characters and unique whatever the capitals; `scores.star_tokens` defaults to 0 |
| `backend/src/db/schema/auth.js` | The new `sessions` table |
| `backend/src/db/schema/index.js` | Exports `auth.js` |
| `backend/drizzle/0001_*.sql` | The generated migration (committed) |
| `backend/src/lib/tokens.js` | `newToken`, `hashToken`: a random token and its SHA-256 hash |
| `backend/src/lib/passwords.js` | Adds `checkPassword`, which takes as long with no account as with one |
| `backend/src/lib/errors.js` | Adds `fieldError` and `isUniqueViolation` |
| `backend/src/lib/sessions.js` | Start, find, renew and end sessions; the cookie settings |
| `backend/src/lib/accounts.js` | `publicUser` and `createPlayer` |
| `backend/src/validation/auth.js` | Zod schemas for sign-up and login |
| `backend/src/middleware/validate.js` | Checks request parts against Zod schemas onto `req.valid` |
| `backend/src/middleware/security.js` | Adds a field error for an email Arcjet refuses |
| `backend/src/middleware/auth.js` | `requireAuth`, `requireRole` |
| `backend/src/routes/auth.routes.js` | `POST /sign-up`, `POST /login`, `POST /logout`, `GET /me` |
| `backend/src/app.js` | Mounts `/api/v1/auth` |
| `backend/tests/schema.test.js` | Adds the name rules, the session cascade and the 0-token default |
| `backend/tests/tokens.test.js` | The tokens |
| `backend/tests/passwords.test.js` | Adds `checkPassword` |
| `backend/tests/validation.test.js` | The Zod schemas, with no database |
| `backend/tests/auth.test.js` | The routes and the role guard |
| `.claude/rules/api.md`, `.claude/rules/backend.md` | The new router, files and folder |
| `docs/learning/02-auth.md` | The phase 2a learning note |

---

### Task 1: Install Zod

**Files:**

- Modify: `backend/package.json`, `backend/package-lock.json`

- [ ] **Step 1: Check the version**

Run from `backend/`: `npm view zod version`
Expected: `4.6.7` or a later 4.x. If it's a later 4.x, tell Slav and use 4.6.7 anyway, to match
`manchester-event`.

- [ ] **Step 2: Install**

Run from `backend/`: `npm install zod@4.6.7`
Expected: `added 1 package`, and `"zod": "^4.6.7"` under `dependencies`.

- [ ] **Step 3: Check the tests still run**

Run from `backend/`: `npm test`
Expected: every existing test passes. If Vitest fails to start with a missing native module, it is
npm 11.5.2's lockfile bug (`Resources/Gotchas.md`): delete `node_modules` and
`package-lock.json`, run `npm install`, and test again.

- [ ] **Step 4: Ask to commit**

Explain: what Zod is (a description of what valid data looks like, checked at run time), and why
it's installed in the phase that first uses it.

Message: `chore: add zod`

---

### Task 2: Schema: sessions, player names, starting tokens

**Files:**

- Create: `backend/src/db/schema/auth.js`
- Modify: `backend/src/db/schema/users.js`, `backend/src/db/schema/index.js`,
  `backend/tests/schema.test.js`
- Create (generated): `backend/drizzle/0001_add_sessions_and_player_names.sql` and its snapshot

- [ ] **Step 1: Write the failing tests**

In `backend/tests/schema.test.js`, change the imports and the clean-up at the top to:

```js
import { describe, it, expect, afterEach } from 'vitest';
import { eq, like } from 'drizzle-orm';

import { db } from '../src/db/index.js';
import { users, scores, sessions, countries, questions } from '../src/db/schema/index.js';

// These tests write to the Neon test branch, so each one removes what it made
const TEST_EMAIL = 'schema-test@example.com';
const OTHER_EMAIL = 'schema-test-2@example.com';
const TEST_COUNTRY = 'Schema Testland';

afterEach(async () => {
    // Deleting a user deletes their score and sessions too (the cascades the tests prove)
    await db.delete(users).where(like(users.email, 'schema-test%@example.com'));
    await db.delete(countries).where(eq(countries.name, TEST_COUNTRY));
});

function addTestUser(values = {}) {
    return db.insert(users)
        .values({ name: 'Schema Test', email: TEST_EMAIL, passwordHash: 'not-a-real-hash', ...values })
        .returning();
}
```

Change the first test's name and its token check to 0:

```js
    it('gives a new user the user role and a new score 0 tokens, and deletes the score with the user', async () => {
```

```js
        expect(score.starTokens).toBe(0);
```

Add these tests inside `describe('database schema', ...)`:

```js
    it('refuses a second player whose name differs only in capitals', async () => {
        await addTestUser();
        const clash = addTestUser({ email: OTHER_EMAIL, name: 'SCHEMA TEST' });
        await expect(clash).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('refuses a name shorter than 3 characters', async () => {
        await expect(addTestUser({ name: 'Al' })).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('refuses a name longer than 20 characters', async () => {
        // 22001 is Postgres's code for a value too long for its column
        await expect(addTestUser({ name: 'A'.repeat(21) })).rejects.toMatchObject({ cause: { code: '22001' } });
    });

    it('deletes a user\'s sessions with the user', async () => {
        const [user] = await addTestUser();
        await db.insert(sessions).values({
            sessionId: 'a'.repeat(64),
            userId: user.userId,
            expiresAt: new Date(Date.now() + 60_000),
        });

        await db.delete(users).where(eq(users.userId, user.userId));
        const left = await db.select().from(sessions).where(eq(sessions.userId, user.userId));
        expect(left).toEqual([]);
    });
```

- [ ] **Step 2: Run them and watch them fail**

Run from `backend/`: `npx vitest run tests/schema.test.js`
Expected: FAIL. The import of `sessions` is `undefined`, so the session test fails; the 0-token test
gets 10; the capitals, short-name and 21-character tests all insert instead of rejecting, because
the column is still 100 long with no rules on it.

- [ ] **Step 3: Write `backend/src/db/schema/auth.js`**

```js
import { pgTable, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';

import { users } from './users.js';

// One row per logged-in device. Only the token's hash is stored, so a leaked row can't log anyone in
export const sessions = pgTable('sessions', {
    sessionId: varchar('session_id', { length: 64 }).primaryKey(),
    userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
    // 30 days, moved forward when fewer than 15 are left
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    // Finding or deleting every session of one user
    index('sessions_user_id_idx').on(table.userId),
]);
```

- [ ] **Step 4: Change `backend/src/db/schema/users.js`**

Replace the import line with:

```js
import { pgTable, pgEnum, integer, varchar, timestamp, check, uniqueIndex } from 'drizzle-orm/pg-core';
```

Replace the `users` table with:

```js
// A player or an admin. People log in by email; the name is shown on the leaderboard
export const users = pgTable('users', {
    userId: integer('user_id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 20 }).notNull(),
    // Stored lowercase: the app lowercases it on sign-up and login
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: roleEnum('role').notNull().default('user'),
    // timestamptz, so the stored time doesn't depend on the server's time zone
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    check('users_name_min_length', sql`char_length(${table.name}) >= 3`),
    // On lower(name), so "Maria" and "maria" can't both exist
    uniqueIndex('users_name_lower_unique').on(sql`lower(${table.name})`),
]);
```

In `scores`, change the tokens line to:

```js
    starTokens: integer('star_tokens').notNull().default(0),
```

- [ ] **Step 5: Export the new file**

`backend/src/db/schema/index.js`:

```js
export * from './users.js';
export * from './quiz.js';
export * from './auth.js';
```

- [ ] **Step 6: Generate the migration and show it to Slav**

Run from `backend/`: `npx drizzle-kit generate --name add_sessions_and_player_names`
Expected: `drizzle/0001_add_sessions_and_player_names.sql` containing, in some order:

- `CREATE TABLE "sessions"` with the foreign key `ON DELETE cascade`
- `ALTER TABLE "users" ALTER COLUMN "name" SET DATA TYPE varchar(20)`
- `ALTER TABLE "scores" ALTER COLUMN "star_tokens" SET DEFAULT 0`
- `CREATE INDEX "sessions_user_id_idx"` and `CREATE UNIQUE INDEX "users_name_lower_unique" ... (lower("name"))`
- `ALTER TABLE "users" ADD CONSTRAINT "users_name_min_length" CHECK (char_length("users"."name") >= 3)`

**Show Slav the whole SQL file and wait for a yes before Step 7.** If the unique index does not
contain `lower("name")`, stop: Drizzle did not take the expression, and the plan needs revising.

- [ ] **Step 7: Apply to both branches**

Run from `backend/`:

```bash
npx drizzle-kit migrate
DB_TARGET=test npx drizzle-kit migrate
```

Expected: both finish with no error. `dev` holds one user, the admin, whose 4-character name meets
both rules, so the type change and the CHECK apply cleanly.

- [ ] **Step 8: Run the tests and watch them pass**

Run from `backend/`: `npx vitest run tests/schema.test.js`
Expected: all schema tests pass.

- [ ] **Step 9: Ask to commit**

Explain: the `sessions` table and why only a hash is stored (a stolen database copy can't be used
to log in); the expression index on `lower(name)` (an index on a calculation, not a column); why
the length rule is a CHECK plus the column size; the three cascades now on `users`; why the default
moved to 0 here.

Message: `feat: add sessions and unique player names`

---

### Task 3: Tokens

**Files:**

- Create: `backend/src/lib/tokens.js`, `backend/tests/tokens.test.js`

- [ ] **Step 1: Write the failing test**

`backend/tests/tokens.test.js`:

```js
import { describe, it, expect } from 'vitest';

import { newToken, hashToken } from '../src/lib/tokens.js';

describe('tokens', () => {
    it('makes a 64-character hex token and returns its hash with it', () => {
        const { token, hash } = newToken();
        expect(token).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).toBe(hashToken(token));
        expect(hash).not.toBe(token);
    });

    it('makes a different token every time', () => {
        expect(newToken().token).not.toBe(newToken().token);
    });

    it('hashes with SHA-256', () => {
        // The published SHA-256 of "abc", so the test doesn't trust the code it checks
        expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run from `backend/`: `npx vitest run tests/tokens.test.js`
Expected: FAIL, `Cannot find module '../src/lib/tokens.js'`.

- [ ] **Step 3: Write `backend/src/lib/tokens.js`**

```js
import crypto from 'node:crypto';

// A random value for a session cookie, and its SHA-256 hash. Only the hash is stored
export function newToken() {
    const token = crypto.randomBytes(32).toString('hex');
    return { token, hash: hashToken(token) };
}

// The SHA-256 hash that is stored instead of the value
export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 4: Run it and watch it pass**

Run from `backend/`: `npx vitest run tests/tokens.test.js`
Expected: 3 passed.

- [ ] **Step 5: Ask to commit**

Explain: 32 random bytes as 64 hex characters; why SHA-256 is right here and bcrypt is right for
passwords (a token is already random and long, so a fast hash is safe; a password is guessable, so
it needs a slow one).

Message: `feat: add session token helpers`

---

### Task 4: Checking a password

**Files:**

- Modify: `backend/src/lib/passwords.js`, `backend/tests/passwords.test.js`

- [ ] **Step 1: Write the failing tests**

In `backend/tests/passwords.test.js`, change the import to:

```js
import { hashPassword, checkPassword } from '../src/lib/passwords.js';
```

and add at the end:

```js
describe('checkPassword', () => {
    it('is true for the right password', async () => {
        const hash = await hashPassword('correct horse');
        expect(await checkPassword('correct horse', hash)).toBe(true);
    });

    it('is false for a wrong password', async () => {
        const hash = await hashPassword('correct horse');
        expect(await checkPassword('correct house', hash)).toBe(false);
    });

    it('is false when there is no account, without throwing', async () => {
        expect(await checkPassword('correct horse', undefined)).toBe(false);
    });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run from `backend/`: `npx vitest run tests/passwords.test.js`
Expected: FAIL, `checkPassword is not a function`.

- [ ] **Step 3: Add to `backend/src/lib/passwords.js`**

Under `BCRYPT_COST`, add:

```js
// Compared against when an email has no account, so a wrong email takes as long as a wrong
// password and the response time can't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('no-account-has-this-password', BCRYPT_COST);
```

At the end, add:

```js
// Whether a password matches a stored hash. With no hash (no such account) it still does the work
export async function checkPassword(password, hash) {
    const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);
    return Boolean(hash) && matches;
}
```

- [ ] **Step 4: Run them and watch them pass**

Run from `backend/`: `npx vitest run tests/passwords.test.js`
Expected: 5 passed.

- [ ] **Step 5: Ask to commit**

Explain: a timing attack, with the numbers (a cost-12 compare takes about a quarter of a second;
skipping it for unknown emails would answer them almost instantly); why the dummy hash is made once
at start-up.

Message: `feat: add password checking`

---

### Task 5: Validation

**Files:**

- Modify: `backend/src/lib/errors.js`
- Create: `backend/src/validation/auth.js`, `backend/src/middleware/validate.js`,
  `backend/tests/validation.test.js`

- [ ] **Step 1: Write the failing tests**

`backend/tests/validation.test.js`:

```js
import { describe, it, expect } from 'vitest';

import { signUpSchema, loginSchema } from '../src/validation/auth.js';

const valid = { name: 'Maria', email: 'maria@example.com', password: 'correct horse' };
const signUpOk = (changes) => signUpSchema.safeParse({ ...valid, ...changes }).success;

describe('signUpSchema', () => {
    it('trims the name, and trims and lowercases the email', () => {
        const data = signUpSchema.parse({ ...valid, name: '  Maria  ', email: ' Maria@Example.COM ' });
        expect(data.name).toBe('Maria');
        expect(data.email).toBe('maria@example.com');
    });

    it('takes names of 3 to 20 characters', () => {
        expect(signUpOk({ name: 'Al' })).toBe(false);
        expect(signUpOk({ name: 'Ali' })).toBe(true);
        expect(signUpOk({ name: 'A'.repeat(20) })).toBe(true);
        expect(signUpOk({ name: 'A'.repeat(21) })).toBe(false);
        // Spaces round a name don't count towards its length
        expect(signUpOk({ name: '  Al  ' })).toBe(false);
    });

    it('takes passwords of 8 to 72 characters', () => {
        expect(signUpOk({ password: 'a'.repeat(7) })).toBe(false);
        expect(signUpOk({ password: 'a'.repeat(8) })).toBe(true);
        expect(signUpOk({ password: 'a'.repeat(72) })).toBe(true);
        expect(signUpOk({ password: 'a'.repeat(73) })).toBe(false);
    });

    it('refuses an email that is not an address', () => {
        expect(signUpOk({ email: 'maria' })).toBe(false);
    });

    it('drops fields it does not list, such as role', () => {
        expect(signUpSchema.parse({ ...valid, role: 'admin' })).not.toHaveProperty('role');
    });
});

describe('loginSchema', () => {
    it('takes any password that is not empty, since only the hash decides', () => {
        expect(loginSchema.safeParse({ email: valid.email, password: 'short' }).success).toBe(true);
        expect(loginSchema.safeParse({ email: valid.email, password: '' }).success).toBe(false);
    });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run from `backend/`: `npx vitest run tests/validation.test.js`
Expected: FAIL, `Cannot find module '../src/validation/auth.js'`.

- [ ] **Step 3: Write `backend/src/validation/auth.js`**

```js
import { z } from 'zod';

// The rules and wording the sign-up and login forms will repeat for quick feedback

export const email = z
    .string({ error: 'Enter your email address.' })
    .trim()
    .toLowerCase()
    .min(1, 'Enter your email address.')
    .pipe(z.email('Enter an email address like name@example.com.').max(255));

// bcrypt only reads the first 72 bytes of a password
export const newPassword = z
    .string({ error: 'Enter a password.' })
    .min(8, 'Use at least 8 characters.')
    .max(72, 'Use 72 characters or fewer.');

// Shown on the leaderboard, so it has to fit there
export const name = z
    .string({ error: 'Enter a player name.' })
    .trim()
    .min(3, 'Use at least 3 characters.')
    .max(20, 'Use 20 characters or fewer.');

// A password typed to prove who you are: checked against the hash, never against the rules
export const currentPassword = z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.');

// No role: every sign-up is a player, and the admin comes from the seed script
export const signUpSchema = z.object({ name, email, password: newPassword });

export const loginSchema = z.object({ email, password: currentPassword });
```

- [ ] **Step 4: Run them and watch them pass**

Run from `backend/`: `npx vitest run tests/validation.test.js`
Expected: 6 passed.

- [ ] **Step 5: Add to `backend/src/lib/errors.js`**

At the end:

```js
// An error shown under one form field, `field` being the body's name for it
export function fieldError(status, field, message) {
    return new AppError(status, message, [{ path: `body.${field}`, message }]);
}

// A broken UNIQUE rule. Drizzle keeps Postgres's own error on `cause`
export const isUniqueViolation = (error) => (error.code ?? error.cause?.code) === '23505';
```

- [ ] **Step 6: Write `backend/src/middleware/validate.js`**

```js
import { AppError } from '../lib/errors.js';

// validate({ body, query, params }) checks each part against its Zod schema onto req.valid.
// Routes read only that, so fields a schema doesn't list never reach the database
export function validate(schemas) {
    return (req, res, next) => {
        const valid = {};
        // Every problem in every part, so a form can show them all at once
        const details = [];

        for (const [part, schema] of Object.entries(schemas)) {
            const result = schema.safeParse(req[part] ?? {});
            if (result.success) {
                valid[part] = result.data;
                continue;
            }
            for (const issue of result.error.issues) {
                details.push({ path: [part, ...issue.path].map(String).join('.'), message: issue.message });
            }
        }

        if (details.length > 0) throw new AppError(400, 'Invalid input', details);
        req.valid = valid;
        next();
    };
}
```

`validate` and `fieldError` are proven through the routes in Task 8.

- [ ] **Step 7: Ask to commit**

Explain: what a schema is, with `'  Maria@Example.COM '` walked through `trim` → `toLowerCase` →
`email`; `safeParse` against `parse`; why unlisted fields are dropped (someone sending
`role: 'admin'`); the `details` list and the `body.email` path a form uses to put a message under
the right box.

Message: `feat: add request validation`

---

### Task 6: Sessions and the auth guards

**Files:**

- Create: `backend/src/lib/sessions.js`, `backend/src/middleware/auth.js`

Both are proven through the routes in Task 8, where a real cookie goes through them.

- [ ] **Step 1: Write `backend/src/lib/sessions.js`**

```js
import { and, eq, gt } from 'drizzle-orm';

import { db } from '../db/index.js';
import { sessions, users } from '../db/schema/index.js';
import { NODE_ENV } from '../config/env.js';
import { newToken, hashToken } from './tokens.js';

export const SESSION_COOKIE = 'sid';

const DAY = 24 * 60 * 60 * 1000;
const SESSION_LENGTH = 30 * DAY;
// A session used with fewer days than this left is moved forward, so someone who plays at least
// every two weeks stays logged in
const RENEW_WITHIN = 15 * DAY;

// httpOnly: page scripts can't read it, so an XSS bug can't steal it.
// sameSite lax: other sites can link here but can't send forms with it
const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: NODE_ENV === 'production',
    path: '/',
};

function setSessionCookie(res, token) {
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_LENGTH });
}

// Removes the session cookie from the browser
export function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
}

// A new session at every login, so a session ID someone planted before login is worthless
export async function startSession(res, userId) {
    const { token, hash } = newToken();
    await db.insert(sessions).values({ sessionId: hash, userId, expiresAt: new Date(Date.now() + SESSION_LENGTH) });
    setSessionCookie(res, token);
}

// The session and its user for a cookie value, or null if it's missing, unknown or expired
export async function findSession(token) {
    if (!token) return null;
    const [row] = await db
        .select({ session: sessions, user: users })
        .from(sessions)
        .innerJoin(users, eq(users.userId, sessions.userId))
        .where(and(eq(sessions.sessionId, hashToken(token)), gt(sessions.expiresAt, new Date())));
    return row ?? null;
}

// Moves a session's end forward when it has fewer than RENEW_WITHIN left
export async function renewSessionIfDue(res, token, session) {
    if (session.expiresAt.getTime() - Date.now() > RENEW_WITHIN) return;
    await db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() + SESSION_LENGTH) })
        .where(eq(sessions.sessionId, session.sessionId));
    setSessionCookie(res, token);
}

// Logs this device out: deletes its session and clears the cookie
export async function endSession(res, token) {
    if (token) await db.delete(sessions).where(eq(sessions.sessionId, hashToken(token)));
    clearSessionCookie(res);
}
```

- [ ] **Step 2: Write `backend/src/middleware/auth.js`**

```js
import { AppError } from '../lib/errors.js';
import { SESSION_COOKIE, findSession, renewSessionIfDue, clearSessionCookie } from '../lib/sessions.js';

// Loads the logged-in user from the session cookie onto req.user, or answers 401
export async function requireAuth(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    const found = await findSession(token);
    if (!found) {
        // An expired or unknown cookie is removed, so the browser stops sending it
        if (token) clearSessionCookie(res);
        throw new AppError(401, 'Please log in to continue');
    }
    await renewSessionIfDue(res, token, found.session);
    req.user = found.user;
    next();
}

// Lets through only the given roles; runs after requireAuth. Checked on the server for every
// request: hiding a link in the frontend protects nothing
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) throw new AppError(403, "You don't have access to this");
        next();
    };
}
```

- [ ] **Step 3: Lint**

Run from `backend/`: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Ask to commit**

Explain: the life of a session, drawn as a timeline (day 0 login, day 20 visit renews to day 50, a
gap of 31 days expires it); the cookie flags one by one and the attack each one stops; session
fixation and why a new session at every login stops it; middleware as a chain, with `requireAuth`
then `requireRole('admin')` in front of a route.

Message: `feat: add sessions and the auth guards`

---

### Task 7: Accounts

**Files:**

- Create: `backend/src/lib/accounts.js`
- Modify: `backend/src/middleware/security.js`

Proven through the routes in Task 8.

- [ ] **Step 1: Write `backend/src/lib/accounts.js`**

```js
import { eq, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { users, scores } from '../db/schema/index.js';
import { fieldError, isUniqueViolation } from './errors.js';
import { hashPassword } from './passwords.js';

// What the frontend may see of an account: everything but the password hash
export function publicUser(user) {
    return {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
    };
}

// Creates a player and their score row together. A taken email or name is a 409 on that field
export async function createPlayer({ name, email, password }) {
    const passwordHash = await hashPassword(password);
    try {
        // One batch, one transaction: there is never a player without a score row
        const [[user]] = await db.batch([
            db.insert(users).values({ name, email, passwordHash }).returning(),
            // The new user's id isn't known until the first insert runs, so a subquery finds it
            db.insert(scores).values({
                userId: sql`(select ${users.userId} from ${users} where ${users.email} = ${email})`,
            }),
        ]);
        return user;
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // The UNIQUE rules decided, so two sign-ups at once can't both get in. Only now ask which
        const [taken] = await db.select({ userId: users.userId }).from(users).where(eq(users.email, email));
        if (taken) throw fieldError(409, 'email', 'An account with this email already exists. Log in instead?');
        throw fieldError(409, 'name', 'This player name is taken. Please choose another.');
    }
}
```

*Revised 2026-11-22, with Slav.* The plan first used `db.insert(scores).select(...)`. Drizzle
0.45.4 has it, but refuses a select that doesn't list every column of the table in order
(`Insert select error: selected fields are not the same...`). Listing all three would write the
0-token default into code as well as the schema, so the score insert takes the user's id from a
parameterised subquery instead, and the columns left out get their database defaults. Checked on
the `test` branch: the score row starts at 0, and a batch whose second statement fails leaves no
user behind, so the batch is one transaction.

- [ ] **Step 2: Report an email Arcjet refuses under the email field**

In `backend/src/middleware/security.js`, change the import to:

```js
import { AppError, fieldError } from '../lib/errors.js';
```

and, inside `if (decision.isDenied())`, after the bot line, add:

```js
            // Disposable, invalid, or a domain that can't receive email. Shown under the field
            if (decision.reason.isEmail()) {
                throw fieldError(400, 'email', "This email address can't be used. Please use another one.");
            }
```

- [ ] **Step 3: Lint**

Run from `backend/`: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Ask to commit**

Explain: why `publicUser` lists fields instead of removing the hash (a column added later stays
private unless someone adds it here); a batch as one transaction, with the walk-through of a
sign-up whose name is taken (the user insert fails, the score insert never commits, nothing is
left); the subquery that finds the new user's id; why the database, not an earlier lookup, decides a clash (two sign-ups
at the same moment).

Message: `feat: add player accounts`

---

### Task 8: The auth routes

**Files:**

- Create: `backend/src/routes/auth.routes.js`, `backend/tests/auth.test.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Write the failing tests**

`backend/tests/auth.test.js`:

```js
import { describe, it, expect, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { eq, like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, scores, sessions } from '../src/db/schema/index.js';
import { hashToken } from '../src/lib/tokens.js';
import { hashPassword } from '../src/lib/passwords.js';
import { requireAuth, requireRole } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// Every account made here has an email starting with this, so afterAll can remove them all
const PREFIX = 'auth-test-';
// Written out here rather than imported, so a wrong value in the app can't make a test agree
const PASSWORD = 'correct-horse-battery';
const DAY = 24 * 60 * 60 * 1000;

let count = 0;
// A new email and player name each time, so tests never clash with each other or an earlier run
function newPlayer(overrides = {}) {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `AuthTest${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD, ...overrides };
}

afterAll(async () => {
    // Scores and sessions go with their users (ON DELETE CASCADE)
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
});

function sessionCookie(res) {
    return res.headers['set-cookie']?.find((cookie) => cookie.startsWith('sid='));
}

// Just `sid=<token>`, the part a browser sends back
const cookieValue = (res) => sessionCookie(res).split(';')[0];

// A signed-up player and an agent that carries their cookie, like a browser
async function signUp(overrides) {
    const agent = request.agent(app);
    const body = newPlayer(overrides);
    const res = await agent.post('/api/v1/auth/sign-up').send(body);
    return { agent, res, body };
}

async function addAdmin() {
    const body = newPlayer();
    await db.insert(users).values({
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(PASSWORD),
        role: 'admin',
    });
    return body;
}

describe('sign-up', () => {
    it('creates a player with a 0-token score, logs them in and never returns the hash', async () => {
        const { agent, res, body } = await signUp();
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ name: body.name, email: body.email, role: 'user' });
        expect(res.body.data).not.toHaveProperty('passwordHash');

        const [score] = await db.select().from(scores).where(eq(scores.userId, res.body.data.userId));
        expect(score.starTokens).toBe(0);

        const me = await agent.get('/api/v1/auth/me');
        expect(me.status).toBe(200);
        expect(me.body.data.userId).toBe(res.body.data.userId);
    });

    it('sets an httpOnly, SameSite=Lax cookie and stores only its hash', async () => {
        const { res } = await signUp();
        const cookie = sessionCookie(res);
        expect(cookie).toMatch(/HttpOnly/);
        expect(cookie).toMatch(/SameSite=Lax/);

        const token = cookie.split(';')[0].slice('sid='.length);
        const rows = await db.select().from(sessions).where(eq(sessions.userId, res.body.data.userId));
        expect(rows).toHaveLength(1);
        expect(rows[0].sessionId).toBe(hashToken(token));
    });

    it('lowercases the email and trims the name', async () => {
        const wanted = newPlayer();
        const { res } = await signUp({ email: wanted.email.toUpperCase(), name: `  ${wanted.name}  ` });
        expect(res.status).toBe(201);
        expect(res.body.data.email).toBe(wanted.email);
        expect(res.body.data.name).toBe(wanted.name);
    });

    it('makes every sign-up a player, even when the body asks for admin', async () => {
        const { res } = await signUp({ role: 'admin' });
        expect(res.status).toBe(201);
        expect(res.body.data.role).toBe('user');
    });

    it('refuses a taken email with 409 under the email field', async () => {
        const first = await signUp();
        const { res } = await signUp({ email: first.body.email });
        expect(res.status).toBe(409);
        expect(res.body.error.details[0].path).toBe('body.email');
    });

    it('refuses a name taken in other capitals with 409 under the name field, and leaves nothing behind', async () => {
        const first = await signUp();
        const { res, body } = await signUp({ name: first.body.name.toUpperCase() });
        expect(res.status).toBe(409);
        expect(res.body.error.details[0].path).toBe('body.name');

        const left = await db.select().from(users).where(eq(users.email, body.email));
        expect(left).toEqual([]);
    });

    it('refuses invalid input with 400 and lists every problem', async () => {
        const res = await request(app).post('/api/v1/auth/sign-up').send({ name: 'Al', email: 'nope', password: 'short' });
        expect(res.status).toBe(400);
        const paths = res.body.error.details.map((detail) => detail.path);
        expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.password']));
    });
});

describe('login', () => {
    it('logs in with any capitals in the email, with a new session every time', async () => {
        const { res: signedUp, body } = await signUp();
        const login = () => request(app).post('/api/v1/auth/login').send({ email: body.email.toUpperCase(), password: PASSWORD });

        const first = await login();
        const second = await login();
        expect(first.status).toBe(200);
        expect(first.body.data.email).toBe(body.email);
        expect(sessionCookie(first)).not.toBe(sessionCookie(second));

        // One from sign-up and one from each login
        const rows = await db.select().from(sessions).where(eq(sessions.userId, signedUp.body.data.userId));
        expect(rows).toHaveLength(3);
    });

    it('gives the same 401 for a wrong password and an unknown email, and no cookie', async () => {
        const { body } = await signUp();
        const wrong = await request(app).post('/api/v1/auth/login').send({ email: body.email, password: 'wrong-password' });
        const unknown = await request(app).post('/api/v1/auth/login').send({ email: `${PREFIX}nobody@example.com`, password: PASSWORD });

        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body.error.message).toBe(unknown.body.error.message);
        expect(sessionCookie(wrong)).toBeUndefined();
        expect(sessionCookie(unknown)).toBeUndefined();
    });

    it('logs in an admin made the way the seed makes one', async () => {
        const admin = await addAdmin();
        const res = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe('admin');
    });
});

describe('logout and me', () => {
    it('answers 401 on /me without a session', async () => {
        const res = await request(app).get('/api/v1/auth/me');
        expect(res.status).toBe(401);
    });

    it('deletes the session on logout, after which /me answers 401', async () => {
        const { agent, res } = await signUp();
        const logout = await agent.post('/api/v1/auth/logout');
        expect(logout.status).toBe(204);

        const rows = await db.select().from(sessions).where(eq(sessions.userId, res.body.data.userId));
        expect(rows).toEqual([]);
        expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    });

    it('answers 401 for an expired session and clears its cookie', async () => {
        const { agent, res } = await signUp();
        await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, res.body.data.userId));

        const me = await agent.get('/api/v1/auth/me');
        expect(me.status).toBe(401);
        expect(sessionCookie(me)).toMatch(/^sid=;/);
    });

    it('moves a session forward when fewer than 15 days are left', async () => {
        const { agent, res } = await signUp();
        await db.update(sessions).set({ expiresAt: new Date(Date.now() + 10 * DAY) }).where(eq(sessions.userId, res.body.data.userId));

        expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
        const [row] = await db.select().from(sessions).where(eq(sessions.userId, res.body.data.userId));
        expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
    });
});

describe('requireRole', () => {
    // A small app with one admin-only route: no admin routes exist yet, and the guard has to be
    // proven before they do. It reads the same session cookies as the real app
    const guarded = express();
    guarded.use(cookieParser());
    guarded.get('/admin-only', requireAuth, requireRole('admin'), (req, res) => res.json({ data: { ok: true } }));
    guarded.use(errorHandler);

    it('answers 401 with no session, 403 for a player and 200 for an admin', async () => {
        const { res: player } = await signUp();
        const admin = await addAdmin();
        const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: PASSWORD });

        expect((await request(guarded).get('/admin-only')).status).toBe(401);
        expect((await request(guarded).get('/admin-only').set('Cookie', cookieValue(player))).status).toBe(403);
        expect((await request(guarded).get('/admin-only').set('Cookie', cookieValue(adminLogin))).status).toBe(200);
    });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run from `backend/`: `npx vitest run tests/auth.test.js`
Expected: FAIL. Every route test gets 404 (`Not found: POST /api/v1/auth/sign-up`); the
`requireRole` test fails at sign-up for the same reason.

- [ ] **Step 3: Write `backend/src/routes/auth.routes.js`**

```js
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { protectSignup, slidingWindow } from '@arcjet/node';

import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { aj } from '../config/arcjet.js';
import { AppError } from '../lib/errors.js';
import { createPlayer, publicUser } from '../lib/accounts.js';
import { checkPassword } from '../lib/passwords.js';
import { SESSION_COOKIE, startSession, endSession } from '../lib/sessions.js';
import { validate } from '../middleware/validate.js';
import { arcjetProtect } from '../middleware/security.js';
import { requireAuth } from '../middleware/auth.js';
import { signUpSchema, loginSchema } from '../validation/auth.js';

const authRouter = Router();

// Stricter Arcjet rules for these routes, made once here (null in tests)
const signUpGuard = aj?.withRule(protectSignup({
    email: { mode: 'LIVE', deny: ['DISPOSABLE', 'INVALID', 'NO_MX_RECORDS'] },
    bots: { mode: 'LIVE', allow: [] },
    rateLimit: { mode: 'LIVE', interval: '1h', max: 5 },
}));
const loginGuard = aj?.withRule(slidingWindow({ mode: 'LIVE', interval: '15m', max: 10 }));

// Creates a player and logs them in straight away
authRouter.post(
    '/sign-up',
    validate({ body: signUpSchema }),
    arcjetProtect(signUpGuard, (req) => ({ email: req.valid.body.email })),
    async (req, res) => {
        const user = await createPlayer(req.valid.body);
        await startSession(res, user.userId);
        res.status(201).json({ data: publicUser(user) });
    },
);

// Logs in with email and password; a new session every time
authRouter.post('/login', arcjetProtect(loginGuard), validate({ body: loginSchema }), async (req, res) => {
    const { email, password } = req.valid.body;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    // Compared even with no account, so the timing can't tell which emails exist
    const matches = await checkPassword(password, user?.passwordHash);
    // One message for both, so the form can't be used to find out who has an account
    if (!user || !matches) throw new AppError(401, 'Email or password is incorrect');

    await startSession(res, user.userId);
    res.json({ data: publicUser(user) });
});

// Logs this device out. Answers 204 even with no session, so it's always safe to call
authRouter.post('/logout', async (req, res) => {
    await endSession(res, req.cookies[SESSION_COOKIE]);
    res.status(204).end();
});

// The logged-in account, which the frontend asks for when it loads
authRouter.get('/me', requireAuth, (req, res) => {
    res.json({ data: publicUser(req.user) });
});

export default authRouter;
```

- [ ] **Step 4: Mount it in `backend/src/app.js`**

Add the import under the health router's:

```js
import authRouter from './routes/auth.routes.js';
```

and the mount under the health mount:

```js
app.use('/api/v1/auth', authRouter);
```

- [ ] **Step 5: Run them and watch them pass**

Run from `backend/`: `npx vitest run tests/auth.test.js`
Expected: 15 passed.

- [ ] **Step 6: Run everything and lint**

Run from `backend/`: `npm test`, then `npm run lint`
Expected: every test passes; no lint errors. Then check the `test` branch is empty again:
`users` has no row whose email starts with `auth-test-` or `schema-test`.

- [ ] **Step 7: Live check in the running app**

Run from `backend/`: `npm run dev` (background). In a second shell, with a browser user agent:

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
curl -s -A "$UA" -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"<the admin email from SEED_ADMIN_EMAIL>","password":"<asked of Slav, typed by Slav>"}' \
  http://localhost:5600/api/v1/auth/login
curl -s -A "$UA" -b jar.txt http://localhost:5600/api/v1/auth/me
curl -s -A "$UA" -b jar.txt -X POST -o /dev/null -w '%{http_code}\n' http://localhost:5600/api/v1/auth/logout
curl -s -A "$UA" -b jar.txt http://localhost:5600/api/v1/auth/me
```

**Slav runs the login line himself** (`! <command>` in the prompt), so the admin password never
enters the chat. Expected: login and `/me` answer the admin with `role: "admin"`; logout prints
`204`; the last `/me` answers 401. Delete `jar.txt`. Stop the server, then check port 5600 is free
and that no `node` process for `src/server.js` is left (`Resources/Gotchas.md`).

*Revised 2026-11-22, with Slav.* A `!` command's text is shown in the chat, so typing the password
into it would not have kept it out. The check ran as a short Node script instead, reading
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `backend/.env` and printing only the responses,
which needs no `jar.txt`. Stopping the background `npm run dev` left nodemon and the server
running on 5600, as `Gotchas.md` warns; both were stopped by process ID.

- [ ] **Step 8: Ask to commit**

Explain: each route walked through with real data (Maria signs up, logs in on a second device,
logs out on the first); the order of the middleware on each route and why validation comes before
Arcjet on sign-up (Arcjet needs the cleaned email) but after it on login (a blocked request costs
nothing); why the role test builds its own small app.

Message: `feat: add sign-up, login and logout`

---

### Task 9: Rules and the learning note

**Files:**

- Modify: `.claude/rules/api.md`, `.claude/rules/backend.md`, `.claude/rules/testing.md`
- Create: `docs/learning/02-auth.md`

- [ ] **Step 1: `api.md`**

Add a row to the routing table:

```markdown
| `/api/v1/auth` | `routes/auth.routes.js`: `POST /sign-up`, `POST /login`, `POST /logout`, `GET /me` |
```

Under `## Responses and errors`, add:

```markdown
- **Validation:** `validate({ body, query, params })` checks each part against a Zod schema in
  `src/validation/` onto `req.valid`; routes read only `req.valid`. A failure is a 400 whose
  `details` list every problem as `{ path: 'body.email', message }`. `fieldError(status, field,
  message)` makes a one-field error the same shape
- **Auth:** `requireAuth` (401) loads `req.user` from the `sid` cookie; `requireRole(...roles)`
  (403) runs after it. Sessions are 30 days, renewed with under 15 left, and new at every login
```

- [ ] **Step 2: `backend.md`**

In the layout, replace the `lib/`, `middleware/` and `db/schema/` lines with:

```text
│   ├── db/schema/          users.js (roleEnum, users, scores), quiz.js (countries, questions),
│   │                       auth.js (sessions), index.js
│   ├── lib/                errors.js (AppError, fieldError, isUniqueViolation), passwords.js,
│   │                       tokens.js, sessions.js, accounts.js (publicUser, createPlayer)
│   ├── middleware/         errorHandler (+ notFound), security (arcjetProtect, securityMiddleware),
│   │                       validate, auth (requireAuth, requireRole)
│   ├── validation/         Zod schemas, one file per resource
```

Under `## Schema conventions (Drizzle)`, add:

```markdown
- Writes to more than one table go in one `db.batch([...])`, which is one transaction on
  `neon-http` (the driver has no interactive transactions)
```

- [ ] **Step 3: `testing.md`**

Under `## Backend`, add:

```markdown
- Route tests that need a logged-in user sign up through the API with `request.agent(app)`, which
  keeps the cookie like a browser. Accounts use a recognisable email prefix (`auth-test-`) and
  are deleted in `afterAll`
```

- [ ] **Step 4: Write `docs/learning/02-auth.md`**

Same shape as `01-schema-and-import.md`: one section per file in the order they were written
(schema, tokens, passwords, validation, sessions and guards, accounts, routes), each with what it
does, inputs and outputs, where it's used and a walk-through with real data. Then:

- **How the files connect**, as a `text` diagram: browser → `sid` cookie → `requireAuth` →
  `findSession` → `sessions` joined to `users` → `req.user` → `requireRole` → route
- **One request end to end:** Maria signs up, from the JSON body to the `Set-Cookie` header
- **Check yourself:** five questions, among them why only the token's hash is stored, why a wrong
  email and a wrong password give the same answer, and what `SameSite=Lax` stops

- [ ] **Step 5: Lint the markdown**

Run from the repo root: `markdownlint-cli2 ".claude/rules/*.md" "docs/learning/*.md"`
Expected: `Summary: 0 issues in 0 files`.

- [ ] **Step 6: Ask to commit**

Message: `docs: add the phase 2a rules and learning note`

---

## Done when

- `npm test` passes with every new test, and the `test` branch holds no test accounts afterwards
- The live check shows the admin logging in, `/me` and logout working
- Both Neon branches record migrations `0000` and `0001`
- `docs/learning/02-auth.md` exists and Slav has the check-yourself questions
- Every commit was asked for and approved
