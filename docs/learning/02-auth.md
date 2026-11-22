# Phase 2a: auth

Phase 2a lets people have accounts: sign up, log in, stay logged in for 30 days and log out. Every
account has a player name no one else has, and routes can be closed to anyone who isn't logged in,
or who isn't an admin. This note grows one section per file, in the order the files were written.

## Zod, the new package

Zod is a library for describing what valid data looks like and checking real data against that
description while the app runs:

```js
const signUp = z.object({
    name: z.string().min(3).max(20),
    email: z.email(),
    password: z.string().min(8).max(72),
});

signUp.safeParse({ name: 'Al', email: 'not-an-email', password: 'short' });
// → success: false, with one problem per field
```

A request body is whatever the browser, or anyone with `curl`, chose to send. Zod is the gate
between that and the code that trusts it. It is installed now, in the phase that first checks
user input, at 4.6.7, the version `manchester-event` uses.

The install broke Vitest with `Cannot find native binding`: npm 11.5.2 had rewritten the lockfile
and dropped the platform-only package that Rolldown, Vitest's bundler, needs on Windows. Deleting
`node_modules` and `package-lock.json` and installing again fixed it, which is why the commit
rewrites most of the lockfile. The bug is in `Resources/Gotchas.md`.

## The schema, file by file

The migration `drizzle/0001_add_sessions_and_player_names.sql` made these changes on both Neon
branches.

### `src/db/schema/auth.js`

One new table, `sessions`: one row per logged-in device.

| Column | Type | Meaning |
| --- | --- | --- |
| `session_id` | `varchar(64)`, primary key | The SHA-256 hash of the token in the browser's cookie |
| `user_id` | integer, not null, refers to `users` | Whose session. Deleting the user deletes it (`cascade`) |
| `expires_at` | timestamptz | 30 days ahead, moved forward when fewer than 15 are left |
| `created_at` | timestamptz, default now | When they logged in |

**Only the hash is stored.** The browser keeps the token itself; on each request the server hashes
the cookie it receives and looks the hash up. SHA-256 can't be run backwards, so a stolen copy of
the table logs no one in. A cloakroom that keeps only photos of its ticket stubs is the picture: a
thief with the photo album still has no ticket. A SHA-256 hash written as hex is always 64
characters, hence `varchar(64)`.

**The index `sessions_user_id_idx`** makes "every session of user 7" a jump rather than a read of
the whole table, like the index at the back of a book. Looking up one session by `session_id` is
already fast: a primary key always has an index.

Walk-through: the admin (user 1) logs in on 2026-11-22 at 15:30. A row appears with
`expires_at` 2026-12-22 15:30. On 2026-12-10 only 12 days are left, fewer than 15, so the next
request moves it to 2027-01-09.

### `src/db/schema/users.js`

Four changes:

1. **`name` is `varchar(20)`**, down from 100. Postgres refuses a longer name with code `22001`
2. **`check('users_name_min_length', char_length(name) >= 3)`.** A column type can only cap a
   length, so the minimum is a CHECK (`23514`). `char_length` counts characters, not bytes:
   "Иван" is 4
3. **`uniqueIndex('users_name_lower_unique').on(lower(name))`**, an *expression index*: an index
   on a calculation instead of a column. The name is stored as typed, but the index holds it
   lowercased, and those must be unique (`23505`)
4. **`scores.star_tokens` defaults to 0**, down from 10: in the new game you earn every token. It
   changes here because sign-up, later in this phase, creates the score row

| Name typed | The index holds | Allowed? |
| --- | --- | --- |
| `Maria` | `maria` | yes, the first |
| `maria` | `maria` | no, clashes with the first |
| `MARIA` | `maria` | no |
| `Mario` | `mario` | yes |

A plain `.unique()` on the column would have let `Maria` and `maria` both exist. Postgres reports
the index as `lower((name)::text)`: it turns the `varchar` into `text` before lowering it.

The plan wasn't sure Drizzle 0.45.4 could write an expression index. It can: the generated SQL has
`CREATE UNIQUE INDEX "users_name_lower_unique" ON "users" USING btree (lower("name"))`.

Two cascades now point at `users`: deleting a user deletes their score and their sessions. Phase
2b's `rounds` table adds a third, as the game spec sets out.

### `src/db/schema/index.js`

One line more, `export * from './auth.js';`. drizzle-kit reads only this file, so a schema file it
doesn't export is invisible to `generate`.

### The tests

Four new tests in `tests/schema.test.js`, and the first one now expects 0 tokens. Each was run
before the schema changed, and failed for the reason it should: `sessions` was `undefined`, the
default was still 10, and three inserts that should have been refused went in.

`addTestUser(values = {})` now takes overrides, spread after the defaults so they win:

```js
addTestUser({ name: 'Al' })   // the usual test user, but named 'Al'
```

The capitals test gives its second user a different email. With the same email, the email rule
would refuse the insert with `23505` too, and the test would pass for the wrong reason.

## The tokens

### `src/lib/tokens.js`

Two functions, used by the sessions code later in this phase.

**`newToken()`** takes nothing and returns `{ token, hash }`. `crypto.randomBytes(32)` asks the
operating system's secure random source for 32 bytes, and `.toString('hex')` writes each byte as
two characters, so the token is 64 characters. A real run:

```text
token  9a0ae312e8beee3d9d861618b041da18615d4f5090d87a121504619d19603a7f   → the sid cookie
hash   729e1310771d02398336f2158b878c80a12d6d2c236b1dfc990a72789a0ebd32   → sessions.session_id
```

32 bytes is 256 bits, about 10⁷⁷ possible tokens, so guessing one is hopeless. `Math.random()` is
predictable and is never used for this.

**`hashToken(token)`** takes a string and returns its SHA-256 hash as 64 hex characters. The same
input always gives the same output, which is how a cookie finds its row: at login the hash is
stored, and on every later request the cookie is hashed again and looked up.

**Why SHA-256 here and bcrypt for passwords:**

| | A token | A password |
| --- | --- | --- |
| Chosen by | the computer, 256 random bits | a person, often guessable |
| An attacker holding the hash tries | 10⁷⁷ possibilities | a list of common passwords |
| So the hash should be | fast: SHA-256, microseconds | slow: bcrypt cost 12, about a quarter of a second |

A slow hash only helps when the input can be guessed. A token can't, so slowing it would only slow
every request.

### `tests/tokens.test.js`

Three tests: the token is 64 hex characters and its hash matches `hashToken`, two tokens are never
the same, and `hashToken('abc')` equals the SHA-256 of "abc" published in the standard. The last
one matters because the first only checks `hashToken` against itself: a function returning its
input unchanged would pass it. Checking against a known value is weighing a known 1 kg weight
rather than trusting the scales to check themselves.
