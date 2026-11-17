# Phase 1: the schema and the import

Phase 1 still builds nothing a player can see. It gives the new app its data: four tables in Neon,
the PHP version's 46 questions copied into them, their 46 photos in Cloudinary, and an admin
account with a new password. By the end, `npm test` runs 18 tests and the `dev` database holds 16
countries, 46 questions and one user.

## The big picture

```text
MySQL wq_db (XAMPP, your machine)            Neon dev (cloud)
  countries: 46 rows, one per question  ──▶    countries: 16 rows
                                                questions: 46 rows ──┐
  src/Images/**/q<n>-*.jpg (46 photos)  ──▶  Cloudinary              │ image_url
                                               world-quiz/development/questions/brazil-q1 ◀──┘

backend/.env  SEED_ADMIN_*  ── npm run db:seed ──▶  users: 1 row (your admin)
```

Two scripts did the work. `npm run db:import` read MySQL, uploaded the photos and wrote the
countries and questions. `npm run db:seed` created your account. Neither runs when the app runs:
they are tools you start by hand.

## From MySQL to Postgres

The new tables aren't a copy of the old ones. Each change fixes something the old layout allowed.

| PHP version (MySQL) | New version (Postgres) | Why |
| --- | --- | --- |
| `countries`: one row per **question**, the country name repeated in each | `countries` (16 rows) + `questions` (46 rows) | Italy was typed six times, so a typo could make two Italys. Now it exists once and questions point at it |
| `is_correct1`, `is_correct2`, `is_correct3` (three true/false flags) | `correct_answer` (1, 2 or 3) | Three flags can all be false, or two true. One number can't be wrong that way |
| `img_path` (a file on the server) | `image_url` + `cloudinary_id` | The photos live in Cloudinary, which serves them resized and in modern formats |
| `users.user_type` | `users.role`, an enum of `user` / `admin` | Same idea, with Postgres refusing any other value |
| `score.level` stored beside `star_tokens` | no `level` column | The level is always `floor(star_tokens / 100) + 1`, so it is worked out instead |
| The saved question kept in the PHP session | `scores.saved_question_id` | It survives logging out and works on any device |

The level change is worth a closer look. The PHP version updates both in one statement
(`src/check_answer.php:54`):

```sql
UPDATE score SET star_tokens = star_tokens + ?, level = floor(star_tokens/100)+1 WHERE id = ?
```

That works, but every other place that changes the tokens must remember to recalculate the level
too. Miss one, and a player has 310 tokens and level 2. A value that can be calculated can never
disagree with itself if it is never stored.

**Why the users weren't copied.** The three PHP accounts were your own test accounts, and you
wanted new passwords. So accounts start fresh: `db:seed` makes the admin, and players will sign up
in the new app.

## The schema, file by file

### `src/db/schema/quiz.js`

Two tables. `pgTable('countries', { ... })` describes a table in JavaScript; nothing is created
until drizzle-kit turns it into SQL. Every column has two names: the JavaScript key your code uses
and the database column it maps to.

```js
countryId: integer('country_id').primaryKey().generatedAlwaysAsIdentity(),
//  └ JavaScript (camelCase)     └ database (snake_case)
```

- **`countries`**: `country_id`, numbered by Postgres itself (`generatedAlwaysAsIdentity`, like
  MySQL's `AUTO_INCREMENT` but nobody can type an id in), and `name`, which is `unique()`
- **`questions`**: `question_id`; `country_id`, a **foreign key** to `countries`; `image_url` and
  `cloudinary_id`; `question`, `hint`, `answer1` to `answer3`; and `correct_answer`
- **`onDelete: 'restrict'`** on the country link: a country can't be deleted while it still has
  questions, so no question is ever left pointing at nothing
- **The CHECK** `correct_answer BETWEEN 1 AND 3`
- **The index** on `country_id`: Postgres indexes primary keys by itself, not foreign keys, and
  "every question for Italy" needs one to avoid reading the whole table

### `src/db/schema/users.js`

- **`roleEnum`**: `pgEnum('role', ['user', 'admin'])`, a type that holds only those two values
- **`users`**: `user_id`, `name`, `email` (`unique()`, stored lowercase), `password_hash` (only ever
  a bcrypt hash), `role` (default `'user'`) and `created_at` (`timestamptz`, default now)
- **`scores`**: `user_id` is both the primary key and a foreign key to `users`, so each user has at
  most one score row. `star_tokens` defaults to 10 with a CHECK that it never goes below 0, and
  `saved_question_id` points at `questions`

Each link deletes differently, on purpose:

| Link | When the other side is deleted | Because |
| --- | --- | --- |
| `questions.country_id` → countries | `restrict`: refused | A question without a country is broken |
| `scores.user_id` → users | `cascade`: the score goes too | A score without its player means nothing |
| `scores.saved_question_id` → questions | `set null`: only the bookmark clears | The player keeps their tokens |

### `src/db/schema/index.js`

Two lines, `export * from './users.js'` and the same for `quiz.js`. drizzle-kit and the app read
the schema from this one file, so a table file not listed here doesn't exist as far as they know.

### `drizzle.config.js`

Tells drizzle-kit where the schema is (`./src/db/schema/index.js`), where to write migrations
(`./drizzle`) and which database to use: `DB_URL` normally, or `TEST_DB_URL` when the command starts
with `DB_TARGET=test`. It throws if the address it needs is missing, the same fail-fast idea as
`db/index.js`.

## Migrations

A **migration** is a SQL file that changes the database from one shape to the next. You never write
it yourself: drizzle-kit compares the schema files with what it saw last time and writes the
difference.

```bash
npx drizzle-kit generate --name initial_schema   # schema → drizzle/0000_initial_schema.sql
npx drizzle-kit migrate                          # run it on dev
DB_TARGET=test npx drizzle-kit migrate           # run it on test
```

`generate` wrote three files:

- **`drizzle/0000_initial_schema.sql`**: the SQL itself. It creates the `role` type first (because
  `users` uses it), then the four tables, then adds the three foreign keys with `ALTER TABLE` at the
  end, because every table has to exist before one can point at another. `--> statement-breakpoint`
  marks where one statement ends so drizzle-kit can run them one at a time
- **`drizzle/meta/0000_snapshot.json`**: what the whole schema looked like at this point. The next
  `generate` compares against it to work out what changed
- **`drizzle/meta/_journal.json`**: the list of migrations in order

`migrate` runs any file the database hasn't had yet, and records each one in a table called
`drizzle.__drizzle_migrations`. That record is why running `migrate` twice is harmless. Both
branches showed exactly one row there after phase 1.

**Why both branches.** The tests run against `test`, and the app against `dev`. If only `dev` had a
new column, the tests would fail for a reason that has nothing to do with the code. So every
migration goes to both, and the SQL is read before it runs, because this file is what really
changes the database.

## The tests

Phase 1 adds 14 tests to phase 0's 4. Each was written first and seen failing before the code
existed.

| File | Tests | What it proves | How it failed first |
| --- | --- | --- | --- |
| `schema.test.js` | 3 | The database's own rules: defaults, the cascade, UNIQUE email, the `correct_answer` CHECK | `Cannot find module`, then `relation "users" does not exist` until the migration ran |
| `cloudinary.test.js` | 2 | The folder per environment, and the exact photo address | `Cannot find module`, then the address had an extra `?_a=…` tag |
| `transform.test.js` | 7 | The MySQL-to-Neon conversions, including the rows they must refuse | `Cannot find module` |
| `passwords.test.js` | 2 | A cost-12 hash that the right password matches and a wrong one doesn't | `Cannot find module` |

**The schema tests break the rules on purpose.** Test 2 adds the same email twice and expects
Postgres error **23505** (UNIQUE broken). Test 3 inserts `correct_answer: 4` and expects **23514**
(CHECK broken). Drizzle wraps Postgres's error, so the code sits on `error.cause.code`:

```js
await expect(addTestUser()).rejects.toMatchObject({ cause: { code: '23505' } });
```

The point of putting these rules in the database rather than the routes: a rule in a table holds
for every way data gets in. The import script, the seed and any future script all obey it without
anyone remembering to check. `afterEach` deletes the test's own rows (`schema-test@example.com`,
`Schema Testland`), so the `test` branch is empty after every run.

**The Cloudinary test caught a real difference.** The package adds `?_a=BAMAROkS0` to every
address, an analytics tag saying which SDK made it. The photo loads either way, but the test
expected nothing after the name. Rather than loosen the test, `urlAnalytics: false` turned the tag
off, so the address stays the same across package updates.

**The password tests can fail.** Test 2 checks that `'Correct horse'`, with a capital C, does
*not* match the hash of `'correct horse'`. Without it, a broken `hashPassword` that matched any
password would still pass test 1.

## The import, traced

`scripts/importFromMysql.js` does the slow, outside work. `scripts/transform.js` holds the three
pure functions it calls, kept apart so they can be tested with no database or network. Here is
Brazil's first question through every step.

**1. Read MySQL.** `readQuestions()` opens a connection, runs `SELECT * FROM countries ORDER BY id`,
and closes the connection in `finally`, so it closes even if the query fails.

```text
{ id: 1, country: 'Brazil', img_path: 'Images/Brasil/q1-jesus christ statue in rio.jpg',
  question: 'Which statue is this?', answer2: 'Jesus Christ in Rio',
  is_correct1: 0, is_correct2: 1, is_correct3: 0, ... }
```

**2. Check every row first.** `questionRows.forEach(correctAnswerOf)` runs the flag check on all
46. A row with two right answers or none stops the import here, before anything is uploaded.

```js
const flags = [row.is_correct1, row.is_correct2, row.is_correct3].map(Number);   // [0, 1, 0]
return flags.indexOf(1) + 1;                                                      // 1 + 1 = 2
```

**3. The safety catch.** `prepareNeon()` refuses if Neon already has questions, unless you ran
`npm run db:import -- --reset`. With `--reset`, it deletes questions and then countries (in that
order, because of `restrict`) and restarts both id counters at 1. It deliberately avoids
`TRUNCATE`: `scores` points at `questions`, so plain `TRUNCATE` is refused and `TRUNCATE ... CASCADE`
would wipe every player's tokens.

**4. The photo.** `imagePublicId('Brazil', img_path)` makes the name from the country column (not
the folder, which is spelt `Brasil`) and the `q1` in the file name:

```text
/\/(q\d+)-[^/]*$/    a slash, then "q" and digits (captured), a hyphen, then no more slashes to the end
→ 'brazil-q1'
```

The upload sends `folder: 'world-quiz/development/questions'` and `public_id: 'brazil-q1'`
separately. Your account uses Cloudinary's **dynamic folders**, where the Media Library folder is
stored apart from the name; one test upload before the real run proved the photo landed in the right
folder, with the full name `world-quiz/development/questions/brazil-q1`. `width: 1600, crop: 'limit'`
shrank it from its original size to 1600 × 1987, 194 KB. All 46 photos go up **before** anything
is written to Neon, because uploading is the slowest step and the likeliest to fail.

**5. Countries.** `new Set(...)` turns the 46 country names into 16 unique ones, all inserted at
once. `.returning()` sends back their new ids, and a `Map` pairs each name with its id, so
`countryIds.get('Brazil')` gives Brazil's.

**6. Questions.** `toQuestion(row, countryId, photo)` builds each Neon row, dropping `id`,
`img_path` and the three flags. All 46 are inserted at once.

```text
question_id 1 | country_id → Brazil | answer2 'Jesus Christ in Rio' | correct_answer 2
image_url https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v1794872152/world-quiz/development/questions/brazil-q1
```

**7. The check.** It counts the rows (16 and 46) and sends a `HEAD` request to every saved photo
address, which asks "is this there?" without downloading it.

The real run on 2026-11-16 took 1 minute 20 seconds and printed:

```text
countries: expected 16, found 16
questions: expected 46, found 46
Photos checked: 46
Import complete: every count matches and every photo loads
```

A second run stopped with `Neon already has questions`, as it should. Asked the way a browser asks,
photo 1 came back as WebP at 179 KB: that is `f_auto,q_auto` choosing the format per visitor.

**One limit.** Neon over HTTP doesn't wrap these inserts in one all-or-nothing transaction. If the
script stopped between the countries and the questions, `--reset` empties both for a clean retry.

## The admin seed

### `src/lib/passwords.js`

```js
export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);   // cost 12
```

A **hash** works one way: nothing turns it back into the password. A bcrypt hash is 60 characters
and carries everything needed to check it later:

```text
$2b$12$ N9qo8uLOickgx2ZMRZoMye IjZAgcfl7p92ldGxad68LJZdL17lhWy
version, cost  22-char salt          31-char hash
```

The **salt** is random, so the same password gives a different hash every time (tested: hashing
`'same'` twice gave two different results). Two players with the same password can't be spotted,
and a ready-made table of common passwords is useless. `bcrypt.compare(typed, hash)` reads the salt
and cost out of the stored hash, so nothing else needs storing. Phase 2's login adds
`checkPassword` here.

**Cost 12** means 2¹² rounds of work. One hash took 413 ms on your machine: unnoticeable at login,
but nearly 5 days (413 ms × 1,000,000) for an attacker to try a million guesses against a single stolen hash.

### `src/db/seed.js`

It reads `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env` and refuses to
run if any is missing. It lowercases the email, hashes the password and inserts the row with
`role: 'admin'`:

```js
.onConflictDoNothing({ target: users.email })   // the email already exists? skip it quietly
.returning({ userId: users.userId });           // [{ userId: 1 }] if created, [] if skipped
```

`onConflictDoNothing` leans on the UNIQUE email rule, so running the seed twice can't make a second
admin or overwrite the first password. The empty or one-row result picks the message. The real
runs printed `Admin created`, then `Admin already exists ... left unchanged`. The password lives
only in `.env`, which git ignores; it was never in the code or the chat.

## Something the import showed

In 37 of the 46 questions, the right answer is answer 1 (answer 2 in 5, answer 3 in 4). A player
who always picks the first answer would score about 80% without looking. The data is fine; phase 2,
which sends questions to players, will shuffle the three answers for each player and remember where
the right one went.

## Check yourself

<details>
<summary>1. Why does <code>scores</code> have no <code>level</code> column?</summary>

Because the level is always `floor(star_tokens / 100) + 1`. Stored separately, it could disagree
with the tokens whenever one update forgot to recalculate it. Worked out when needed, it can't.

</details>
<details>
<summary>2. An admin deletes the question a player stopped on. What happens to the player?</summary>

Their `scores` row stays, tokens and all. The link has `onDelete: 'set null'`, so only
`saved_question_id` becomes `NULL`, which means "start from the first question".

</details>
<details>
<summary>3. Why are all 46 photos uploaded before any row is written?</summary>

Uploading is the slowest step and the one most likely to fail. If photo 30 fails, Neon is still
empty and you simply run the import again. Writing first would leave questions pointing at photos
that don't exist.

</details>
<details>
<summary>4. What happens if you run <code>npm run db:seed</code> twice?</summary>

The second run does nothing and says so. The email is UNIQUE, and `onConflictDoNothing` tells
Postgres to skip the insert instead of raising an error. The first password stays.

</details>
<details>
<summary>5. Why does <code>--reset</code> delete rows instead of using <code>TRUNCATE</code>?</summary>

`scores.saved_question_id` points at `questions`. Postgres refuses a plain `TRUNCATE` on a table
something points at, and `TRUNCATE ... CASCADE` would empty `scores` as well, wiping every player's
tokens. Deleting row by row only clears the bookmarks, through `set null`.

</details>
<details>
<summary>6. Why do the photo uploads pass <code>folder</code> separately from <code>public_id</code>?</summary>

Your Cloudinary account uses dynamic folders, where the Media Library folder is stored apart from
the photo's name. A folder written only into the name would leave the photo at the root of the
library, mixed in with `manchester-event`'s files.

</details>
