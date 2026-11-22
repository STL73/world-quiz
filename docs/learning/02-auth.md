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

## Checking a password

### `src/lib/passwords.js`

`hashPassword` came in phase 1. This phase adds `checkPassword(password, hash)`: it takes what
someone typed and the hash stored for their account, and returns `true` or `false`.

```js
const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);
return Boolean(hash) && matches;
```

When the email has no account, the login route has no hash and passes `undefined`. Calling
`bcrypt.compare` with `undefined` would throw, so `??` swaps in `DUMMY_HASH`: "use `hash`, unless
it is `null` or `undefined`". Then `Boolean(hash) && matches` makes sure the answer can only be
`true` when a real hash was there, even if someone typed the dummy's password.

**Why compare against a dummy instead of answering `false` at once: a timing attack.** The tests
ran before the function existed, and the times showed the problem. A real check took about 320 ms;
failing straight away took 2 ms. A login route built like that gives the secret away by speed:

```text
maria@example.com,  wrong password  →  answer in 320 ms  →  "this email has an account"
nobody@example.com, wrong password  →  answer in   5 ms  →  "no account here"
```

The messages are the same, but the stopwatch tells an attacker which emails are worth guessing
passwords for. With the dummy, all three cases take the same time:

```text
right password   true   314 ms
wrong password   false  294 ms
no account       false  279 ms
```

The 20 to 30 ms between them is ordinary noise from whatever else the computer is doing.

**`DUMMY_HASH` is made once, at start-up.** It sits at the top level of the module, so it runs when
the file is first imported: about 0.3 seconds, once. Made inside `checkPassword`, every unknown
email would pay for a hash *and* a compare, and be slower than a real login: a new gap in the other
direction. `hashSync` blocks while it works, which a server normally avoids, but it finishes before
any request arrives.

### `tests/passwords.test.js`

Three new tests: the right password gives `true`, a password one letter off gives `false`, and no
hash at all gives `false` without throwing. The equal timing isn't asserted in a test, because a
test that depends on milliseconds fails at random on a busy machine. It was measured by hand
instead, with the figures above.

## Validation

Four files: the rules, two error helpers, and the middleware that runs the rules on each request.

### `src/validation/auth.js`

A Zod schema is a chain of steps, like a production line: each one reshapes the value or rejects
it with a message. `email`, given `' Maria@Example.COM '`:

```text
z.string(...)      is it text at all?            ' Maria@Example.COM '   ✓
.trim()            cut spaces at both ends    →  'Maria@Example.COM'
.toLowerCase()                                →  'maria@example.com'
.min(1, ...)       not empty?                                            ✓
.pipe(z.email()    a real address shape?                                 ✓
      .max(255))   fits the column?                                      ✓
```

`.pipe` hands the cleaned value to a second schema, so the address check sees it after trimming.

- **`name`**: trimmed, then 3 to 20 characters, the same range as the database rules but with
  messages a person can read. Trimming comes first, so `'  Al  '` is a 2-character name
- **`newPassword`**: 8 to 72 characters and never trimmed, since spaces can be part of a password.
  bcrypt reads only the first 72 bytes, so a longer one is refused rather than silently cut
- **`currentPassword`**: anything not empty. The rules apply when a password is chosen; at login
  only the hash decides, and refusing a short one would only tell a stranger the rules
- **`signUpSchema`** has no `role`. A Zod object keeps only the fields it lists, so a sign-up sent
  with `"role": "admin"` comes out as a plain player

`parse` returns the clean data or throws. `safeParse` returns `{ success, data }` or
`{ success: false, error }` and never throws, so every problem can be collected.

A real run with `{ name: '  Al ', email: 'maria', password: 'short' }` gives one issue per field:

```text
name      Use at least 3 characters.
email     Enter an email address like name@example.com.
password  Use at least 8 characters.
```

### `src/lib/errors.js`

Two helpers next to `AppError`:

- **`fieldError(status, field, message)`** makes an error tied to one form field, for problems Zod
  can't see, like an email already in use. Its `details` look exactly like Zod's:
  `[{ path: 'body.email', message }]`, so a form puts the message under the right box whichever
  one produced it
- **`isUniqueViolation(error)`** is `true` for Postgres's `23505`. `error.code ?? error.cause?.code`
  reads the code on the error or, as Drizzle wraps it, on its `cause`; `?.` gives `undefined`
  instead of crashing when there is no `cause`. Sign-up uses it when two people take the same name
  at the same moment and the unique index stops the second

### `src/middleware/validate.js`

`validate(schemas)` builds a middleware. Given `{ body: signUpSchema }`, on each request it:

1. runs `safeParse` on `req.body` (an absent part is checked as `{}`)
2. keeps the cleaned data in `valid.body`, or adds every issue to `details` with the part's name in
   front: `['email']` becomes `'body.email'`
3. throws a 400 `AppError` if anything failed, which `errorHandler` sends; otherwise sets
   `req.valid` and calls `next()`

Tried on a throwaway app, a good sign-up with `role: 'admin'` added came back as:

```text
200  req.valid.body = { name: 'Maria', email: 'maria@example.com', password: 'correct horse' }
     req.body.role  = 'admin'
```

The raw `req.body` still holds the role. Zod leaves out what it doesn't list from its clean copy,
not from the original, which is why routes read only `req.valid`. A body with a short name, a bad
email and no password came back as one 400 with all three problems in `details`, so a form can mark
every box at once.

It works like a security desk: it checks your pass against the list and either hands you a visitor
badge (`req.valid`) or turns you away with a note of everything wrong. The rooms inside only look
at the badge.

### `tests/validation.test.js`

Six tests, none touching the database: the clean-up, the name and password lengths at both edges,
a non-address, the dropped `role`, and a login password that is short but not empty. `signUpOk`
changes one field of a good sign-up at a time, so a failure points at exactly one rule.
`fieldError` and `validate` are proven through the routes, in the route tests.

## Sessions and the guards

Neither file has a test of its own: the route tests send a real cookie through both.

### `src/lib/sessions.js`

The life of a session:

```text
day 0    log in    startSession        row ends day 30, cookie lasts 30 days
day 10   play      findSession ✓       20 days left, more than 15: nothing changes
day 20   play      findSession ✓       10 days left: renewSessionIfDue moves the end to day 50
                                       and sends the cookie again
day 81   come back findSession ✗       it ended on day 50: 401, "Please log in to continue"
```

Anyone who plays at least once every 15 days stays logged in. Renewing only when fewer than 15
days are left keeps most requests to a single read.

| Function | Does | Used by |
| --- | --- | --- |
| `startSession(res, userId)` | `newToken()`, stores the hash with an end 30 days ahead, puts the token in the `sid` cookie | sign-up, login |
| `findSession(token)` | hashes the cookie, finds a row that matches and hasn't ended, joined to its user: `{ session, user }` or `null` | `requireAuth` |
| `renewSessionIfDue(res, token, session)` | with fewer than 15 days left, moves the end to 30 days ahead and sends the cookie again | `requireAuth` |
| `endSession(res, token)` | deletes this device's row and clears the cookie | logout |
| `clearSessionCookie(res)` | tells the browser to forget `sid` | logout, `requireAuth` |

`findSession` uses an inner join, so one query brings back the session and the user together: one
trip to Neon per request instead of two.

**The cookie's flags, and what each stops:**

| Flag | Means | Stops |
| --- | --- | --- |
| `httpOnly` | page scripts can't read it | XSS theft: a script injected into the page still can't read `sid` and send it away |
| `sameSite: 'lax'` | sent when you follow a link here, not with a form posted from another site | CSRF: a hidden form on an evil page posts without your cookie, so it arrives logged out |
| `secure` in production | sent only over HTTPS | someone on the same Wi-Fi reading it on the way. Off locally, where `localhost` is plain HTTP |
| `maxAge` 30 days | when the browser drops it | (matches the row's `expires_at`) |

**Session fixation.** An attacker gets a session ID into your browser before you log in, on a
shared computer for instance. If logging in upgraded that same session, the attacker would share
your logged-in one. `startSession` makes a new random token at every login, so anything planted
before is worthless.

### `src/middleware/auth.js`

**`requireAuth`** reads the `sid` cookie and asks `findSession`. Nothing found: it clears the
cookie, if one was sent, so the browser stops sending a dead one, and answers 401. Found: it renews
if due, puts the user on `req.user` and calls `next()`. `req.user` is the whole row, password hash
included; it stays on the server, and responses are built from `publicUser`, never from `req.user`.

**`requireRole(...roles)`** builds a middleware; `...roles` gathers its arguments into a list. A
role not on the list gets 403. 401 is "I don't know who you are"; 403 is "I know, and no".

Middleware is a chain: each one passes the request on with `next()` or stops it by throwing.

```js
router.get('/users', requireAuth, requireRole('admin'), listUsers);
```

| Caller | `requireAuth` | `requireRole('admin')` | `listUsers` |
| --- | --- | --- | --- |
| no cookie | 401, stops | | |
| Maria, a player | passes, `req.user` is Maria | 403, stops | |
| the admin | passes | passes | runs |

`requireRole` reads what `requireAuth` set, so the order matters. Hiding the admin link in React is
tidiness, not security: anyone can send the request with `curl`, and this check on the server is
the lock.
