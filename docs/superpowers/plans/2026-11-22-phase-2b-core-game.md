# Phase 2b: Core Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task, inline, with Slav in the loop. Steps use checkbox (`- [ ]`) syntax for
> tracking. Subagent-driven execution is not used: every file is explained to Slav before the next
> one is written.

**Goal:** a logged-in player can start a round of 10 questions, see each one with its answers
shuffled, use the hint, answer, earn tokens by the spec's rules, leave and come back, give up, and
see the results; admins can't play; tests prove all of it.

**Architecture:** two new tables, `rounds` and `round_questions`. Picking, shuffling and scoring
are pure functions with no database. `lib/rounds.js` holds every database step of the game, and
`routes/rounds.routes.js` is a thin router over it. The answer is saved by one SQL statement that
updates the `round_questions` row only while it is unanswered and feeds the tokens it saved into
the `scores` update, batched with the update that finishes the round.

**Tech stack:** Express 5, Drizzle ORM 0.45.4 on `neon-http` (`db.batch()`, `$with` and
`update().from()`), drizzle-kit 0.31.11, Zod 4.6.7, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-11-17-core-game-design.md`.

---

## Decisions taken while planning (2026-11-22)

The first row answers the spec's open point. The rows marked **new** go beyond the spec or change
it, and need Slav's yes before Task 2 starts.

| Decision | Choice | Why |
| --- | --- | --- |
| How the answer stays consistent | One statement: a CTE (`WITH answered AS (UPDATE round_questions ... WHERE answered_at IS NULL RETURNING tokens_awarded)`) feeds the `scores` update. It goes in one `db.batch()` with the update that finishes the round | Postgres locks the row being updated. A second request for the same row waits, then re-checks `answered_at IS NULL` against the row the first one saved, finds it set and updates nothing, so its `scores` update adds nothing. The scores update needs to know whether *this* request's update saved a row, and only the CTE's `RETURNING` says that from inside one statement. Drizzle 0.45.4 builds this statement with every value as a parameter (checked with `.toSQL()` on 2026-11-22). That Neon runs it as intended is proven by Task 8's two-answers-at-once test |
| **New:** a question must be opened before it is answered | The answer and hint routes answer 409 when the current question's `shown_at` is empty | The spec's "a double click earns once" only holds when the two requests overlap. If the first finishes before the second is read, the current question is already the next one, and the second click would answer it unseen. `GET /rounds/current` records `shown_at`, so a question the player hasn't loaded can't be answered |
| **New:** where repeats go | The picked questions are shuffled into a random order, so repeats can come anywhere in the round | The spec picks unseen questions first, and its level figure (640–650) assumes repeats fall anywhere. Without the shuffle, repeats would always be the last questions |
| **New:** the results hide unanswered questions' answers | A summary shows the right answer only for questions that were answered | Otherwise giving up would show the answers to the questions left, which come back as unseen in the next round |
| **New:** the results of a round in play | `GET /rounds/:id` answers 404 for a round that is still active | The spec says it shows finished or abandoned rounds; an active round's results would give away its answers |
| **New:** the hint and the answer at once | The answer is saved only if `hint_used` is still what the route read | A hint recorded between the answer's read and its write would otherwise be scored at 10 instead of 5. The losing request gets 409 |
| **New:** two more CHECK rules | `rounds`: an ended round has `finished_at`, an active one doesn't. `round_questions`: `answered_at`, `chosen_answer` and `correct` are all set or all empty | `backend.md`: rules the data must follow live in the schema |
| **New:** what `chosen_answer` stores | The stored answer number (1 to 3), not the button position | It means the same thing whatever the shuffle was |
| **New:** `POST /rounds` answers with the first question | 201 with the same body as `GET /rounds/current` | Saves the browser a second request |
| **New:** no questions at all | `POST /rounds` answers 409 `There are no questions to play yet` | Not reachable on `dev`, which has 46, but the route must not make an empty round |
| **New:** test files run one at a time | `fileParallelism: false` in `vitest.config.js` | A round picks from every question on the `test` branch. If `schema.test.js` ran beside `rounds.test.js`, a round could pick a schema-test question, and the schema test's clean-up would then be refused by the `restrict` rule |
| **New:** the live check also checks sign-up | Task 9 signs up through the running API with Arcjet on: one disposable address, which must get 400, then one real-looking one | The handover's open item: the sign-up Arcjet guard has never run live |

Confidence: high that the CTE statement is safe on Postgres. Medium that `db.batch()` accepts a
`$with` update on `neon-http`, which nothing here has run yet. Task 8 stops if it doesn't.

## How every task runs

1. Write one file
2. **Explain it to Slav** (the points are listed in each task): what each function does, what goes
   in and comes out, where it's used, a walk-through with real data, and an analogy where it helps.
   Wait until Slav is ready before the next file
3. After the last step of a task, add that task's explanation to `docs/learning/03-core-game.md`
   (Task 10 lists the sections)
4. **Commit only after asking Slav and getting a clear yes.** Every commit step below means: show
   the files, propose the message, ask, wait. Push is a separate question

Code style: backend uses single quotes and 4-space indents. Comments follow the standard: one plain
line above each exported function or table, and a "why" only when the code can't show it.

Local live checks: send a browser user agent (see `api.md`): a plain `curl` is classed as a bot
and Arcjet then blocks every request for about a minute, browser included.

## File map

| File | Responsibility |
| --- | --- |
| `backend/vitest.config.js` | Test files run one at a time |
| `backend/src/db/schema/game.js` | `roundStatusEnum`, `rounds`, `roundQuestions` |
| `backend/src/db/schema/users.js` | Drops `scores.saved_question_id` |
| `backend/src/db/schema/index.js` | Exports `game.js` |
| `backend/drizzle/0002_add_rounds.sql` | The generated migration (committed) |
| `backend/src/lib/scoring.js` | `nextStreak`, `streakOf`, `tokensFor` |
| `backend/src/lib/picking.js` | `ROUND_SIZE`, `shuffle`, `pickQuestions`, `shuffleAnswers` |
| `backend/src/validation/rounds.js` | `answerSchema`, `roundParamsSchema` |
| `backend/src/lib/rounds.js` | Start, show, hint, answer, abandon and sum up a round |
| `backend/src/routes/rounds.routes.js` | The six play routes |
| `backend/src/app.js` | Mounts `/api/v1/rounds` |
| `backend/scripts/importFromMysql.js` | A comment that mentions `saved_question_id` |
| `backend/tests/schema.test.js` | The game tables' rules |
| `backend/tests/scoring.test.js` | Scoring, with the spec's worked example |
| `backend/tests/picking.test.js` | Picking and shuffling |
| `backend/tests/validation.test.js` | The two new schemas |
| `backend/tests/rounds.test.js` | The routes |
| `.claude/rules/api.md`, `backend.md`, `testing.md` | The new router, files and patterns |
| `docs/learning/03-core-game.md` | The phase 2b learning note |

---

### Task 1: Run test files one at a time

**Files:**

- Modify: `backend/vitest.config.js`

- [ ] **Step 1: Time the suite as it is**

Run from `backend/`: `npm test`
Expected: 49 tests pass across 9 files. Note the `Duration` line.

- [ ] **Step 2: Add the setting**

In `backend/vitest.config.js`, inside `test`, after `setupFiles`:

```js
        // One file at a time: a round picks from every question on the test branch, so a file
        // adding questions must not run beside one playing rounds
        fileParallelism: false,
```

- [ ] **Step 3: Time it again**

Run from `backend/`: `npm test`
Expected: 49 pass. Tell Slav both durations. If it is more than twice as slow, stop and discuss
before going on.

- [ ] **Step 4: Ask to commit**

Explain: what Vitest does by default (several files at once, each in its own worker), why that is
fine for pure tests and risky for tests sharing one database, and what it costs.

Message: `test: run test files one at a time`

---

### Task 2: Schema: rounds and round questions

**Files:**

- Create: `backend/src/db/schema/game.js`
- Modify: `backend/src/db/schema/users.js`, `backend/src/db/schema/index.js`,
  `backend/scripts/importFromMysql.js`
- Create (generated): `backend/drizzle/0002_add_rounds.sql`, `backend/drizzle/meta/0002_snapshot.json`
- Test: `backend/tests/schema.test.js`

- [ ] **Step 1: Write the failing tests**

In `backend/tests/schema.test.js`, change the imports to:

```js
import { users, scores, sessions, countries, questions, rounds, roundQuestions } from '../src/db/schema/index.js';
```

Replace the `afterEach` with:

```js
afterEach(async () => {
    // Deleting a user deletes their score, sessions and rounds too (the cascades the tests prove)
    await db.delete(users).where(like(users.email, 'schema-test%@example.com'));
    // A played question can't be deleted, so this has to wait until the rounds are gone
    await db.delete(questions).where(eq(questions.cloudinaryId, 'schema-test'));
    await db.delete(countries).where(eq(countries.name, TEST_COUNTRY));
});
```

After `addTestUser`, add:

```js
async function addTestQuestion(values = {}) {
    const [existing] = await db.select().from(countries).where(eq(countries.name, TEST_COUNTRY));
    const country = existing ?? (await db.insert(countries).values({ name: TEST_COUNTRY }).returning())[0];
    const [question] = await db.insert(questions).values({
        countryId: country.countryId,
        imageUrl: 'https://example.com/photo.jpg',
        cloudinaryId: 'schema-test',
        question: 'Which landmark is this?',
        hint: 'A test hint',
        answer1: 'A',
        answer2: 'B',
        answer3: 'C',
        correctAnswer: 1,
        ...values,
    }).returning();
    return question;
}

async function addTestRound(values = {}) {
    const [user] = await addTestUser();
    const [round] = await db.insert(rounds).values({ userId: user.userId, ...values }).returning();
    return { user, round };
}

function addRoundQuestion(roundId, questionId, values = {}) {
    return db.insert(roundQuestions)
        .values({ roundId, questionId, position: 1, answerOrder: [3, 1, 2], ...values })
        .returning();
}
```

In the first test, replace `expect(score.savedQuestionId).toBeNull();` with:

```js
        // The active round is now the saved place
        expect(score).not.toHaveProperty('savedQuestionId');
```

Replace the body of `refuses a correct answer outside 1 to 3` with:

```js
        // 23514 is Postgres's code for a broken CHECK rule
        await expect(addTestQuestion({ correctAnswer: 4 })).rejects.toMatchObject({ cause: { code: '23514' } });
```

At the end of the file, add:

```js
describe('game tables', () => {
    it('starts a round active, and deletes it and its questions with the player', async () => {
        const question = await addTestQuestion();
        const { user, round } = await addTestRound();
        expect(round.status).toBe('active');
        expect(round.finishedAt).toBeNull();

        const [row] = await addRoundQuestion(round.roundId, question.questionId);
        expect(row.answerOrder).toEqual([3, 1, 2]);
        expect(row.hintUsed).toBe(false);
        expect(row.tokensAwarded).toBe(0);
        expect(row.answeredAt).toBeNull();

        await db.delete(users).where(eq(users.userId, user.userId));
        expect(await db.select().from(rounds).where(eq(rounds.roundId, round.roundId))).toEqual([]);
        expect(await db.select().from(roundQuestions).where(eq(roundQuestions.roundId, round.roundId))).toEqual([]);
    });

    it('allows one active round per player, beside ended ones', async () => {
        const { user } = await addTestRound({ status: 'finished', finishedAt: new Date() });
        await db.insert(rounds).values({ userId: user.userId });
        const second = db.insert(rounds).values({ userId: user.userId });
        await expect(second).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('refuses an ended round with no end time', async () => {
        await expect(addTestRound({ status: 'abandoned' })).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it.each([
        ['a repeated answer', [1, 1, 2]],
        ['two answers', [1, 2]],
        ['an answer outside 1 to 3', [1, 2, 4]],
    ])('refuses an answer order with %s', async (_, answerOrder) => {
        const question = await addTestQuestion();
        const { round } = await addTestRound();
        const insert = addRoundQuestion(round.roundId, question.questionId, { answerOrder });
        await expect(insert).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it.each([
        ['a position above 10', { position: 11 }],
        ['a chosen answer outside 1 to 3', { answeredAt: new Date(), chosenAnswer: 4, correct: false }],
        ['negative tokens', { tokensAwarded: -5 }],
        ['an answer time with no chosen answer', { answeredAt: new Date() }],
    ])('refuses a round question with %s', async (_, values) => {
        const question = await addTestQuestion();
        const { round } = await addTestRound();
        const insert = addRoundQuestion(round.roundId, question.questionId, values);
        await expect(insert).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('refuses the same question twice in a round', async () => {
        const question = await addTestQuestion();
        const { round } = await addTestRound();
        await addRoundQuestion(round.roundId, question.questionId);
        const again = addRoundQuestion(round.roundId, question.questionId, { position: 2 });
        await expect(again).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('refuses to delete a question that has been in a round', async () => {
        const question = await addTestQuestion();
        const { round } = await addTestRound();
        await addRoundQuestion(round.roundId, question.questionId);
        // 23001 is Postgres's code for a delete an ON DELETE RESTRICT rule refused. A foreign key
        // without one (NO ACTION) gives 23503 instead
        const remove = db.delete(questions).where(eq(questions.questionId, question.questionId));
        await expect(remove).rejects.toMatchObject({ cause: { code: '23001' } });
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run from `backend/`: `npx vitest run tests/schema.test.js`
Expected: FAIL. `rounds` and `roundQuestions` are `undefined`, so the game tests throw.

- [ ] **Step 3: Write `backend/src/db/schema/game.js`**

```js
import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, integer, smallint, boolean, timestamp, check, index, unique, uniqueIndex } from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { questions } from './quiz.js';

export const roundStatusEnum = pgEnum('round_status', ['active', 'finished', 'abandoned']);

// One game of up to 10 questions. Its position, streak and total are worked out from its questions
export const rounds = pgTable('rounds', {
    roundId: integer('round_id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
    status: roundStatusEnum('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (table) => [
    // Only over active rows, so a player has any number of ended rounds but one in play
    uniqueIndex('rounds_one_active_per_user').on(table.userId).where(sql`${table.status} = 'active'`),
    index('rounds_user_id_idx').on(table.userId),
    check('rounds_finished_at_matches_status', sql`(${table.status} = 'active') = (${table.finishedAt} IS NULL)`),
]);

// One question in a round, how its answers are shown, and how the player answered it
export const roundQuestions = pgTable('round_questions', {
    roundQuestionId: integer('round_question_id').primaryKey().generatedAlwaysAsIdentity(),
    roundId: integer('round_id').notNull().references(() => rounds.roundId, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    // A played question can't be deleted; admin tools will hide it instead
    questionId: integer('question_id').notNull().references(() => questions.questionId, { onDelete: 'restrict' }),
    // Button n shows stored answer answerOrder[n - 1]
    answerOrder: integer('answer_order').array().notNull(),
    shownAt: timestamp('shown_at', { withTimezone: true }),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    // The stored answer number the player picked, whatever button it was on
    chosenAnswer: smallint('chosen_answer'),
    hintUsed: boolean('hint_used').notNull().default(false),
    correct: boolean('correct'),
    tokensAwarded: integer('tokens_awarded').notNull().default(0),
}, (table) => [
    unique('round_questions_round_position_unique').on(table.roundId, table.position),
    unique('round_questions_round_question_unique').on(table.roundId, table.questionId),
    index('round_questions_question_id_idx').on(table.questionId),
    check('round_questions_position_range', sql`${table.position} BETWEEN 1 AND 10`),
    check('round_questions_chosen_answer_range', sql`${table.chosenAnswer} BETWEEN 1 AND 3`),
    check('round_questions_tokens_not_negative', sql`${table.tokensAwarded} >= 0`),
    // Three items that include 1, 2 and 3 can only be those three, each once
    check('round_questions_answer_order_shuffle', sql`cardinality(${table.answerOrder}) = 3 AND ${table.answerOrder} @> ARRAY[1, 2, 3]`),
    check('round_questions_answer_complete', sql`(${table.answeredAt} IS NULL) = (${table.chosenAnswer} IS NULL) AND (${table.answeredAt} IS NULL) = (${table.correct} IS NULL)`),
]);
```

Explain: the enum; why the partial UNIQUE index stops two rounds at once where a check in the
route could not; `restrict` against `cascade`; what `@>` means on arrays; why streak, position and
total are not columns (the spec's "worked out, not stored").

- [ ] **Step 4: Drop `saved_question_id` and export the new file**

In `backend/src/db/schema/users.js`, delete the `import { questions } from './quiz.js';` line and
the two `savedQuestionId` lines (its comment and the column), and change the comment above
`scores` to:

```js
// A player's tokens. The level is worked out from them, never stored
```

In `backend/src/db/schema/index.js`, add as the last line:

```js
export * from './game.js';
```

In `backend/scripts/importFromMysql.js`, replace the two comment lines above `await db.delete(questions);` with:

```js
        // Row by row, not TRUNCATE: TRUNCATE refuses because round_questions points at questions.
        // A question that has been played can't be deleted at all, so a reset only works before play
```

- [ ] **Step 5: Generate the migration**

Run from `backend/`: `npx drizzle-kit generate --name add_rounds`
Expected: `drizzle/0002_add_rounds.sql` is written, with no question asked (nothing is renamed).

- [ ] **Step 6: Show Slav the SQL**

Run from `backend/`: `cat drizzle/0002_add_rounds.sql`
Expected, in some order: `CREATE TYPE "public"."round_status" AS ENUM('active', 'finished', 'abandoned')`;
`CREATE TABLE "rounds"` and `CREATE TABLE "round_questions"` with the five CHECKs and two UNIQUEs;
`ALTER TABLE "scores" DROP CONSTRAINT "scores_saved_question_id_questions_question_id_fk"`;
`ALTER TABLE "scores" DROP COLUMN "saved_question_id"`; three foreign keys (`cascade`, `cascade`,
`restrict`); `CREATE UNIQUE INDEX "rounds_one_active_per_user" ... WHERE "rounds"."status" = 'active'`
and two plain indexes. Anything else, or a `WHERE` that has lost its condition: stop and tell Slav.
Walk through it with Slav and wait for a yes before applying.

- [ ] **Step 7: Apply it to both branches**

Run from `backend/`:

```bash
npx drizzle-kit migrate
DB_TARGET=test npx drizzle-kit migrate
```

Expected: both finish without an error.

- [ ] **Step 8: Run the tests to see them pass**

Run from `backend/`: `npx vitest run tests/schema.test.js`
Expected: PASS, 19 tests (7 before, 12 new). Then `npm test`: every file passes.

- [ ] **Step 9: Lint and ask to commit**

Run from `backend/`: `npm run lint`. Expected: no problems.

Message: `feat: add rounds and round questions`

---

### Task 3: Scoring

**Files:**

- Create: `backend/src/lib/scoring.js`
- Test: `backend/tests/scoring.test.js`

- [ ] **Step 1: Write the failing test**

`backend/tests/scoring.test.js`:

```js
import { describe, it, expect } from 'vitest';

import { nextStreak, streakOf, tokensFor } from '../src/lib/scoring.js';

// Plays a list of answers the way the answer route does, and adds up the tokens
function playRound(answers) {
    let streak = 0;
    return answers.reduce((total, answer) => {
        streak = nextStreak(streak, answer.correct);
        return total + tokensFor({ ...answer, streak });
    }, 0);
}

const right = { correct: true, firstTime: true, hintUsed: false };
const wrong = { correct: false, firstTime: true, hintUsed: false };

describe('scoring', () => {
    it('gives 10 for a first-time correct answer and 5 with the hint', () => {
        expect(tokensFor({ ...right, streak: 1 })).toBe(10);
        expect(tokensFor({ ...right, hintUsed: true, streak: 1 })).toBe(5);
    });

    it('gives nothing for a wrong answer or a repeat, streak bonus included', () => {
        expect(tokensFor({ ...wrong, streak: 0 })).toBe(0);
        expect(tokensFor({ ...right, firstTime: false, streak: 5 })).toBe(0);
    });

    it('adds 5 from the 3rd correct answer in a row, with or without the hint', () => {
        expect(tokensFor({ ...right, streak: 2 })).toBe(10);
        expect(tokensFor({ ...right, streak: 3 })).toBe(15);
        expect(tokensFor({ ...right, hintUsed: true, streak: 3 })).toBe(10);
    });

    it('resets the streak on a wrong answer and counts repeats in it', () => {
        expect(nextStreak(4, false)).toBe(0);
        expect(nextStreak(2, true)).toBe(3);
        expect(streakOf([{ correct: true }, { correct: false }, { correct: true }, { correct: true }])).toBe(2);
        expect(streakOf([])).toBe(0);
    });

    it('scores the spec\'s worked example at 110', () => {
        const hinted = { ...right, hintUsed: true };
        expect(playRound([right, right, right, right, wrong, right, hinted, right, right, right])).toBe(110);
    });

    it('scores the best round at 140', () => {
        expect(playRound(Array(10).fill(right))).toBe(140);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run from `backend/`: `npx vitest run tests/scoring.test.js`
Expected: FAIL, `Failed to load url ../src/lib/scoring.js` (or "Cannot find module").

- [ ] **Step 3: Write `backend/src/lib/scoring.js`**

```js
// Tokens for a correct answer the first time, and the same with the hint
const FIRST_TIME_TOKENS = 10;
const HINT_TOKENS = 5;
// Extra tokens for each correct answer from the STREAK_FROM-th in a row
const STREAK_BONUS = 5;
const STREAK_FROM = 3;

// The streak after an answer: correct answers in a row in this round, repeats included
export const nextStreak = (streakBefore, correct) => (correct ? streakBefore + 1 : 0);

// The streak at the end of a list of answers, oldest first
export const streakOf = (answers) => answers.reduce((streak, answer) => nextStreak(streak, answer.correct), 0);

// The tokens one answer earns, `streak` being the streak including this answer
export function tokensFor({ correct, firstTime, hintUsed, streak }) {
    // A repeat earns nothing, bonus included, so replaying known questions can't farm tokens
    if (!correct || !firstTime) return 0;
    const base = hintUsed ? HINT_TOKENS : FIRST_TIME_TOKENS;
    return base + (streak >= STREAK_FROM ? STREAK_BONUS : 0);
}
```

- [ ] **Step 4: Run it to see it pass**

Run from `backend/`: `npx vitest run tests/scoring.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Ask to commit**

Explain: why scoring has no database (milliseconds to test, and the rules sit in one place); the
worked example row by row against the spec's table; why the streak is passed in rather than
stored.

Message: `feat: add the scoring rules`

---

### Task 4: Picking and shuffling

**Files:**

- Create: `backend/src/lib/picking.js`
- Test: `backend/tests/picking.test.js`

- [ ] **Step 1: Write the failing test**

`backend/tests/picking.test.js`:

```js
import { describe, it, expect } from 'vitest';

import { ROUND_SIZE, shuffle, pickQuestions, shuffleAnswers } from '../src/lib/picking.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Random tests run many times, so a rule that holds only by luck is caught
const RUNS = 200;

describe('pickQuestions', () => {
    it('picks every unseen question before any repeat', () => {
        // 15 questions, 1 to 8 already answered correctly: 9 to 15 must all be in, plus 3 repeats
        for (let run = 0; run < RUNS; run += 1) {
            const picked = pickQuestions(range(1, 15), range(1, 8));
            expect(picked).toHaveLength(ROUND_SIZE);
            expect(picked).toEqual(expect.arrayContaining(range(9, 15)));
            expect(new Set(picked).size).toBe(ROUND_SIZE);
        }
    });

    it('mixes the repeats in among the unseen questions', () => {
        // If repeats always came last, position 1 would never hold one
        const firsts = new Set();
        for (let run = 0; run < RUNS; run += 1) firsts.add(pickQuestions(range(1, 15), range(1, 8))[0]);
        expect([...firsts].some((id) => id <= 8)).toBe(true);
    });

    it('never picks more questions than exist', () => {
        const picked = pickQuestions([4, 7, 9], []);
        expect([...picked].sort()).toEqual([4, 7, 9]);
    });

    it('fills a round with repeats once everything has been answered', () => {
        const picked = pickQuestions(range(1, 46), range(1, 46));
        expect(picked).toHaveLength(ROUND_SIZE);
        expect(new Set(picked).size).toBe(ROUND_SIZE);
    });
});

describe('shuffling', () => {
    it('always gives the answers 1, 2 and 3, each once, and in time every order', () => {
        const orders = new Set();
        for (let run = 0; run < RUNS * 3; run += 1) {
            const order = shuffleAnswers();
            expect([...order].sort()).toEqual([1, 2, 3]);
            orders.add(order.join(''));
        }
        expect(orders.size).toBe(6);
    });

    it('leaves the list it was given as it was', () => {
        const items = [1, 2, 3, 4];
        shuffle(items);
        expect(items).toEqual([1, 2, 3, 4]);
    });

    it('uses the random source it is given', () => {
        // Math.random() always just below 1 means every swap is with itself: no change
        expect(shuffle([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run from `backend/`: `npx vitest run tests/picking.test.js`
Expected: FAIL, the module can't be found.

- [ ] **Step 3: Write `backend/src/lib/picking.js`**

```js
export const ROUND_SIZE = 10;

// A shuffled copy (Fisher–Yates). `random` is Math.random unless a test passes its own
export function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// The question ids for a new round: ones not yet answered correctly first, then random others,
// up to ROUND_SIZE, in a random order
export function pickQuestions(allIds, correctIds, random = Math.random) {
    const done = new Set(correctIds);
    const unseen = shuffle(allIds.filter((id) => !done.has(id)), random);
    const repeats = shuffle(allIds.filter((id) => done.has(id)), random);
    return shuffle([...unseen, ...repeats].slice(0, ROUND_SIZE), random);
}

// The order a question's answers are shown in: button n shows stored answer order[n - 1]
export const shuffleAnswers = (random = Math.random) => shuffle([1, 2, 3], random);
```

- [ ] **Step 4: Run it to see it pass**

Run from `backend/`: `npx vitest run tests/picking.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Ask to commit**

Explain: Fisher–Yates with a five-card walk-through, and why the obvious
`sort(() => Math.random() - 0.5)` is unfair; the spec's Paris/Lyon/Nice example of `answerOrder`;
why the final shuffle exists (the decisions table); why the random source can be passed in.

Message: `feat: add question picking and answer shuffling`

---

### Task 5: Validating an answer and a round id

**Files:**

- Create: `backend/src/validation/rounds.js`
- Test: `backend/tests/validation.test.js`

- [ ] **Step 1: Write the failing tests**

In `backend/tests/validation.test.js`, add below the existing import:

```js
import { answerSchema, roundParamsSchema } from '../src/validation/rounds.js';
```

At the end of the file, add:

```js
describe('answerSchema', () => {
    const answerOk = (body) => answerSchema.safeParse(body).success;

    it('takes button 1, 2 or 3 as a whole number', () => {
        expect(answerOk({ choice: 1 })).toBe(true);
        expect(answerOk({ choice: 3 })).toBe(true);
        expect(answerOk({ choice: 0 })).toBe(false);
        expect(answerOk({ choice: 4 })).toBe(false);
        expect(answerOk({ choice: 2.5 })).toBe(false);
        // JSON text is not a number: the frontend sends a number
        expect(answerOk({ choice: '2' })).toBe(false);
        expect(answerOk({})).toBe(false);
    });
});

describe('roundParamsSchema', () => {
    it('turns the id in the address into a positive whole number', () => {
        expect(roundParamsSchema.parse({ id: '12' })).toEqual({ id: 12 });
        expect(roundParamsSchema.safeParse({ id: 'abc' }).success).toBe(false);
        expect(roundParamsSchema.safeParse({ id: '0' }).success).toBe(false);
        expect(roundParamsSchema.safeParse({ id: '1.5' }).success).toBe(false);
        // Above Postgres's integer limit, which would otherwise be a database error and a 500
        expect(roundParamsSchema.safeParse({ id: '2147483648' }).success).toBe(false);
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run from `backend/`: `npx vitest run tests/validation.test.js`
Expected: FAIL, `../src/validation/rounds.js` can't be found.

- [ ] **Step 3: Write `backend/src/validation/rounds.js`**

```js
import { z } from 'zod';

const CHOICE_MESSAGE = 'Choose answer 1, 2 or 3.';

// The button the player pressed, counted from the left as the answers are shown
export const answerSchema = z.object({
    choice: z.int({ error: CHOICE_MESSAGE }).min(1, CHOICE_MESSAGE).max(3, CHOICE_MESSAGE),
});

// A round id from the address, which always arrives as text. Postgres integers end at 2147483647
export const roundParamsSchema = z.object({
    id: z.coerce.number().int().positive().max(2147483647),
});
```

- [ ] **Step 4: Run them to see them pass**

Run from `backend/`: `npx vitest run tests/validation.test.js`
Expected: PASS, every old test and the 2 new ones.

- [ ] **Step 5: Ask to commit**

Explain: why `choice` is the button and not the stored answer (the browser never knows the stored
numbers); `z.coerce` and why only the params need it; what the 400 looks like through `validate`.

Message: `feat: validate answers and round ids`

---

### Task 6: Starting and showing a round

**Files:**

- Create: `backend/src/lib/rounds.js`, `backend/src/routes/rounds.routes.js`,
  `backend/tests/rounds.test.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Write the failing tests**

`backend/tests/rounds.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { and, asc, eq, isNull, like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, scores, countries, questions, rounds, roundQuestions } from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/passwords.js';

// Everything made here is recognisable, so afterAll can remove it all
const PREFIX = 'rounds-test-';
const COUNTRY = 'Rounds Testland';
const CLOUDINARY_ID = 'rounds-test';
const PASSWORD = 'correct-horse-battery';
// 12, so a second round has 2 unseen questions after a first round of 10
const QUESTION_COUNT = 12;
// A full round makes about 40 requests to the test branch
const LONG = 90_000;

const ROUNDS = '/api/v1/rounds';
const CURRENT = `${ROUNDS}/current`;
const HINT = `${CURRENT}/hint`;
const ANSWER = `${CURRENT}/answer`;
const ABANDON = `${CURRENT}/abandon`;

beforeAll(async () => {
    const [country] = await db.insert(countries).values({ name: COUNTRY }).returning();
    await db.insert(questions).values(Array.from({ length: QUESTION_COUNT }, (_, i) => ({
        countryId: country.countryId,
        imageUrl: `https://example.com/rounds-test-${i}.jpg`,
        cloudinaryId: CLOUDINARY_ID,
        question: `Rounds test question ${i}`,
        hint: `Rounds test hint ${i}`,
        answer1: `Q${i} answer 1`,
        answer2: `Q${i} answer 2`,
        answer3: `Q${i} answer 3`,
        // Spread over 1 to 3, so code that always reads the same answer can't pass
        correctAnswer: (i % 3) + 1,
    })));
});

afterAll(async () => {
    // Rounds go with their players; only then can the played questions be deleted
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
    await db.delete(questions).where(eq(questions.cloudinaryId, CLOUDINARY_ID));
    await db.delete(countries).where(eq(countries.name, COUNTRY));
});

let count = 0;
function newAccount() {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `Rounds${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD };
}

// A signed-up player and an agent that carries their cookie, like a browser
async function newPlayer() {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/sign-up').send(newAccount());
    return { agent, userId: res.body.data.userId };
}

// The player's current question as the database holds it, for checks the API must not answer
async function currentRow(userId) {
    const [row] = await db
        .select({ rq: roundQuestions, correctAnswer: questions.correctAnswer, hint: questions.hint })
        .from(roundQuestions)
        .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
        .innerJoin(questions, eq(questions.questionId, roundQuestions.questionId))
        .where(and(eq(rounds.userId, userId), eq(rounds.status, 'active'), isNull(roundQuestions.answeredAt)))
        .orderBy(asc(roundQuestions.position))
        .limit(1);
    return row;
}

// The button showing the right answer, read from the database: the API never says before the answer
async function rightChoice(userId) {
    const { rq, correctAnswer } = await currentRow(userId);
    return rq.answerOrder.indexOf(correctAnswer) + 1;
}

const wrongOf = (choice) => (choice % 3) + 1;

// Answers right or wrong, then opens the next question as the game page will
async function answer(player, right = true) {
    const choice = await rightChoice(player.userId);
    const res = await player.agent.post(ANSWER).send({ choice: right ? choice : wrongOf(choice) });
    if (res.status === 200 && !res.body.data.summary) await player.agent.get(CURRENT);
    return res;
}

async function starTokens(userId) {
    const [score] = await db.select().from(scores).where(eq(scores.userId, userId));
    return score.starTokens;
}

describe('starting a round', () => {
    it('picks 10 different questions, shuffles each, and shows the first without its answer', async () => {
        const player = await newPlayer();
        const res = await player.agent.post(ROUNDS);
        expect(res.status).toBe(201);
        expect(res.body.data).toEqual({
            roundId: expect.any(Number),
            position: 1,
            total: 10,
            question: {
                imageUrl: expect.stringMatching(/^https:\/\/example\.com\/rounds-test-/),
                text: expect.stringMatching(/^Rounds test question/),
                answers: [expect.any(String), expect.any(String), expect.any(String)],
                hint: null,
            },
            tokensEarned: 0,
            streak: 0,
        });
        // Nothing in the body may say which answer is right
        expect(JSON.stringify(res.body)).not.toMatch(/correct|answerOrder/i);

        const rows = await db.select().from(roundQuestions).where(eq(roundQuestions.roundId, res.body.data.roundId));
        expect(rows).toHaveLength(10);
        expect(new Set(rows.map((row) => row.questionId)).size).toBe(10);
        for (const row of rows) expect([...row.answerOrder].sort()).toEqual([1, 2, 3]);
    });

    it('shows the answers in the order the round stored', async () => {
        const player = await newPlayer();
        const res = await player.agent.post(ROUNDS);
        const { rq } = await currentRow(player.userId);
        const [question] = await db.select().from(questions).where(eq(questions.questionId, rq.questionId));
        expect(res.body.data.question.answers).toEqual(rq.answerOrder.map((n) => question[`answer${n}`]));
    });

    it('refuses a second round while one is in play', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const second = await player.agent.post(ROUNDS);
        expect(second.status).toBe(409);
    });

    it('starts only one round from two Play clicks at once', async () => {
        const player = await newPlayer();
        const results = await Promise.all([player.agent.post(ROUNDS), player.agent.post(ROUNDS)]);
        expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
        const active = await db.select().from(rounds).where(and(eq(rounds.userId, player.userId), eq(rounds.status, 'active')));
        expect(active).toHaveLength(1);
    });
});

describe('the current round', () => {
    it('continues where the player left off and records when the question was shown', async () => {
        const player = await newPlayer();
        const started = await player.agent.post(ROUNDS);
        await answer(player);

        // A new agent is a new visit: log in again and carry on
        const again = request.agent(app);
        const [user] = await db.select().from(users).where(eq(users.userId, player.userId));
        await again.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
        const res = await again.get(CURRENT);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ roundId: started.body.data.roundId, position: 2, tokensEarned: 10, streak: 1 });
        expect((await currentRow(player.userId)).rq.shownAt).toBeInstanceOf(Date);
    });

    it('answers 404 when there is no round in play', async () => {
        const player = await newPlayer();
        expect((await player.agent.get(CURRENT)).status).toBe(404);
    });
});

describe('who can play', () => {
    it('needs a logged-in player', async () => {
        expect((await request(app).post(ROUNDS)).status).toBe(401);
    });

    it('turns admins away', async () => {
        const account = newAccount();
        await db.insert(users).values({
            name: account.name,
            email: account.email,
            passwordHash: await hashPassword(PASSWORD),
            role: 'admin',
        });
        const admin = request.agent(app);
        await admin.post('/api/v1/auth/login').send({ email: account.email, password: PASSWORD });
        expect((await admin.post(ROUNDS)).status).toBe(403);
    });
});
```

The `continues where the player left off` test also needs the answer route (Task 8). Mark it
`it.skip` for now, with a note, and remove the `.skip` in Task 8 Step 4.

- [ ] **Step 2: Run them to see them fail**

Run from `backend/`: `npx vitest run tests/rounds.test.js`
Expected: FAIL, with 404 `Not found: POST /api/v1/rounds` (the router doesn't exist yet). One
test passes already: `answers 404 when there is no round in play`, because `notFound` answers 404
too. It guards the real route once it exists.

- [ ] **Step 3: Write `backend/src/lib/rounds.js`**

```js
import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { questions, rounds, roundQuestions } from '../db/schema/index.js';
import { AppError, isUniqueViolation } from './errors.js';
import { pickQuestions, shuffleAnswers } from './picking.js';
import { streakOf } from './scoring.js';

const NO_ROUND = 'You have no round in play. Press Play to start one';

// Starts a round: picks its questions and shuffles each one's answers. 409 if one is in play
export async function startRound(userId) {
    const all = await db.select({ questionId: questions.questionId }).from(questions);
    if (all.length === 0) throw new AppError(409, 'There are no questions to play yet');

    const correct = await db
        .selectDistinct({ questionId: roundQuestions.questionId })
        .from(roundQuestions)
        .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
        .where(and(eq(rounds.userId, userId), eq(roundQuestions.correct, true)));
    const picked = pickQuestions(all.map((row) => row.questionId), correct.map((row) => row.questionId));

    // The round's id isn't known until it's inserted. It is the player's one active round
    const roundId = sql`(select ${rounds.roundId} from ${rounds} where ${rounds.userId} = ${userId} and ${rounds.status} = 'active')`;
    try {
        await db.batch([
            db.insert(rounds).values({ userId }),
            db.insert(roundQuestions).values(picked.map((questionId, index) => ({
                roundId,
                position: index + 1,
                questionId,
                answerOrder: shuffleAnswers(),
            }))),
        ]);
    } catch (error) {
        // The one-active-round rule decided, so two Play clicks at once can't both start one
        if (isUniqueViolation(error)) throw new AppError(409, 'You already have a round in play');
        throw error;
    }
}

// The player's active round and its questions in order. 404 if there is none
async function activeRound(userId) {
    const [round] = await db.select().from(rounds).where(and(eq(rounds.userId, userId), eq(rounds.status, 'active')));
    if (!round) throw new AppError(404, NO_ROUND);
    const rows = await db
        .select({ rq: roundQuestions, question: questions })
        .from(roundQuestions)
        .innerJoin(questions, eq(questions.questionId, roundQuestions.questionId))
        .where(eq(roundQuestions.roundId, round.roundId))
        .orderBy(asc(roundQuestions.position));
    return { round, rows };
}

// The first question not yet answered. The answer route finishes a round with its last answer,
// so an active round always has one
const nextRow = (rows) => rows.find((row) => !row.rq.answeredAt);

// The tokens and streak so far in a round
function progress(rows) {
    const answered = rows.filter((row) => row.rq.answeredAt).map((row) => row.rq);
    return {
        tokensEarned: answered.reduce((sum, rq) => sum + rq.tokensAwarded, 0),
        streak: streakOf(answered),
    };
}

// What the player sees of their round, never the right answer. Records when a question is first shown
export async function currentRound(userId) {
    const { round, rows } = await activeRound(userId);
    const { rq, question } = nextRow(rows);
    if (!rq.shownAt) {
        await db.update(roundQuestions).set({ shownAt: new Date() }).where(eq(roundQuestions.roundQuestionId, rq.roundQuestionId));
    }
    return {
        roundId: round.roundId,
        position: rq.position,
        total: rows.length,
        question: {
            imageUrl: question.imageUrl,
            text: question.question,
            answers: rq.answerOrder.map((n) => question[`answer${n}`]),
            hint: rq.hintUsed ? question.hint : null,
        },
        ...progress(rows),
    };
}
```

Task 7 and Task 8 add to this file; the functions above don't change.

- [ ] **Step 4: Write `backend/src/routes/rounds.routes.js`**

```js
import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { startRound, currentRound } from '../lib/rounds.js';

const roundsRouter = Router();

// Every play route needs a logged-in player; admins don't play
roundsRouter.use(requireAuth, requireRole('user'));

// Starts a round and shows its first question
roundsRouter.post('/', async (req, res) => {
    await startRound(req.user.userId);
    res.status(201).json({ data: await currentRound(req.user.userId) });
});

// The round in play, where the player left it
roundsRouter.get('/current', async (req, res) => {
    res.json({ data: await currentRound(req.user.userId) });
});

export default roundsRouter;
```

- [ ] **Step 5: Mount it in `backend/src/app.js`**

Add the import after `authRouter`'s:

```js
import roundsRouter from './routes/rounds.routes.js';
```

And the router after `app.use('/api/v1/auth', authRouter);`:

```js
app.use('/api/v1/rounds', roundsRouter);
```

- [ ] **Step 6: Run the tests to see them pass**

Run from `backend/`: `npx vitest run tests/rounds.test.js`
Expected: PASS, 7 tests, 1 skipped. If the batch fails because the subquery finds no round, stop
and tell Slav: it would mean a batch's statements don't see each other's writes, which `accounts.js`
depends on too.

- [ ] **Step 7: Lint and ask to commit**

Run from `backend/`: `npm test`, then `npm run lint`. Expected: all pass, no problems.

Explain: the two-statement batch and its subquery, the same pattern as `createPlayer`; why the
catch is in `lib/` and not the route (`api.md`: no try/catch in routes); why `currentRound` builds
its object field by field (nothing joins the response by accident, the right answer least of all);
`router.use` putting the guards in front of every route at once.

Message: `feat: start and show a round`

---

### Task 7: The hint and giving up

**Files:**

- Modify: `backend/src/lib/rounds.js`, `backend/src/routes/rounds.routes.js`
- Test: `backend/tests/rounds.test.js`

- [ ] **Step 1: Write the failing tests**

At the end of `backend/tests/rounds.test.js`, add:

```js
describe('the hint', () => {
    it('gives the current question\'s hint, the same again on a second ask, and shows it with the question', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const { hint } = await currentRow(player.userId);

        const first = await player.agent.post(HINT);
        expect(first.status).toBe(200);
        expect(first.body.data).toEqual({ hint });
        expect((await player.agent.post(HINT)).body.data).toEqual({ hint });
        expect((await player.agent.get(CURRENT)).body.data.question.hint).toBe(hint);
        expect((await currentRow(player.userId)).rq.hintUsed).toBe(true);
    });

    it('answers 404 when there is no round in play', async () => {
        const player = await newPlayer();
        expect((await player.agent.post(HINT)).status).toBe(404);
    });
});

describe('giving up', () => {
    it('ends the round, keeps nothing open, and lets a new round start', async () => {
        const player = await newPlayer();
        const started = await player.agent.post(ROUNDS);

        const res = await player.agent.post(ABANDON);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ roundId: started.body.data.roundId, status: 'abandoned', correctCount: 0, total: 10 });
        // Unanswered questions keep their answers secret: they come back in later rounds
        for (const question of res.body.data.questions) {
            expect(question).toMatchObject({ correct: null, chosenAnswer: null, correctAnswer: null });
        }
        expect((await player.agent.get(CURRENT)).status).toBe(404);
        expect((await player.agent.post(ROUNDS)).status).toBe(201);
    });

    it('answers 404 when there is no round in play', async () => {
        const player = await newPlayer();
        expect((await player.agent.post(ABANDON)).status).toBe(404);
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run from `backend/`: `npx vitest run tests/rounds.test.js`
Expected: the 4 new tests FAIL with 404 `Not found: POST /api/v1/rounds/current/hint` (and
`.../abandon`). The two "no round" tests may pass already, since the route's 404 looks the same.
That's fine; they guard the real route once it exists.

- [ ] **Step 3: Add to `backend/src/lib/rounds.js`**

Change the first import line to:

```js
import { and, asc, eq, ne, sql } from 'drizzle-orm';
```

And the schema import to:

```js
import { countries, questions, rounds, roundQuestions } from '../db/schema/index.js';
```

After `nextRow`, add:

```js
// The question on the player's screen. One not yet opened with GET /current can't be used, so a
// second click after an answer can't land on the next question unseen
function openRow(rows) {
    const row = nextRow(rows);
    if (!row.rq.shownAt) throw new AppError(409, 'That question has already been answered');
    return row;
}
```

At the end of the file, add:

```js
// The current question's hint, recorded as used. Asking again gives the same hint
export async function useHint(userId) {
    const { rq, question } = openRow((await activeRound(userId)).rows);
    if (!rq.hintUsed) {
        await db.update(roundQuestions).set({ hintUsed: true }).where(eq(roundQuestions.roundQuestionId, rq.roundQuestionId));
    }
    return { hint: question.hint };
}

// Gives up the round in play. The tokens it earned stay
export async function abandonRound(userId) {
    const [round] = await db
        .update(rounds)
        .set({ status: 'abandoned', finishedAt: new Date() })
        .where(and(eq(rounds.userId, userId), eq(rounds.status, 'active')))
        .returning();
    if (!round) throw new AppError(404, NO_ROUND);
    return roundSummary(userId, round.roundId);
}

// An ended round's results. A round still in play, or another player's, is a 404, so the address
// can't give away answers
export async function roundSummary(userId, roundId) {
    const [round] = await db
        .select()
        .from(rounds)
        .where(and(eq(rounds.roundId, roundId), eq(rounds.userId, userId), ne(rounds.status, 'active')));
    if (!round) throw new AppError(404, 'Round not found');

    const rows = await db
        .select({ rq: roundQuestions, question: questions, country: countries.name })
        .from(roundQuestions)
        .innerJoin(questions, eq(questions.questionId, roundQuestions.questionId))
        .innerJoin(countries, eq(countries.countryId, questions.countryId))
        .where(eq(roundQuestions.roundId, roundId))
        .orderBy(asc(roundQuestions.position));

    return {
        roundId: round.roundId,
        status: round.status,
        startedAt: round.startedAt,
        finishedAt: round.finishedAt,
        correctCount: rows.filter((row) => row.rq.correct).length,
        total: rows.length,
        tokensEarned: rows.reduce((sum, row) => sum + row.rq.tokensAwarded, 0),
        questions: rows.map(({ rq, question, country }) => ({
            position: rq.position,
            imageUrl: question.imageUrl,
            text: question.question,
            country,
            // Only for answered questions: the others come back as unseen in later rounds
            correctAnswer: rq.answeredAt ? question[`answer${question.correctAnswer}`] : null,
            chosenAnswer: rq.chosenAnswer ? question[`answer${rq.chosenAnswer}`] : null,
            correct: rq.correct,
            hintUsed: rq.hintUsed,
            tokensEarned: rq.tokensAwarded,
        })),
    };
}
```

- [ ] **Step 4: Add the routes**

In `backend/src/routes/rounds.routes.js`, change the lib import to:

```js
import { startRound, currentRound, useHint, abandonRound } from '../lib/rounds.js';
```

Before `export default roundsRouter;`, add:

```js
// The current question's hint, which halves what a right answer earns
roundsRouter.post('/current/hint', async (req, res) => {
    res.json({ data: await useHint(req.user.userId) });
});

// Gives up the round in play and shows its results
roundsRouter.post('/current/abandon', async (req, res) => {
    res.json({ data: await abandonRound(req.user.userId) });
});
```

- [ ] **Step 5: Run the tests to see them pass**

Run from `backend/`: `npx vitest run tests/rounds.test.js`
Expected: PASS, 11 tests, 1 skipped.

- [ ] **Step 6: Lint and ask to commit**

Run from `backend/`: `npm test`, then `npm run lint`. Expected: all pass, no problems.

Explain: why the hint is recorded on the server (a hint the browser kept to itself couldn't halve
the tokens); `openRow` and the double-click case it closes; why the summary hides some answers;
`ne` and why `roundSummary` checks the owner in the same query rather than after it.

Message: `feat: add the hint and giving up`

---

### Task 8: Answering

**Files:**

- Modify: `backend/src/lib/rounds.js`, `backend/src/routes/rounds.routes.js`
- Test: `backend/tests/rounds.test.js`

- [ ] **Step 1: Write the failing tests**

At the end of `backend/tests/rounds.test.js`, add:

```js
describe('answering', () => {
    it('plays a full round of right answers to 140 tokens, then finishes it', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);

        const earned = [];
        let last;
        for (let i = 0; i < 10; i += 1) {
            last = await answer(player);
            expect(last.status).toBe(200);
            expect(last.body.data).toMatchObject({ correct: true, streak: i + 1 });
            earned.push(last.body.data.tokensEarned);
        }
        expect(earned).toEqual([10, 10, 15, 15, 15, 15, 15, 15, 15, 15]);
        expect(last.body.data.starTokens).toBe(140);
        expect(last.body.data.summary).toMatchObject({ status: 'finished', correctCount: 10, total: 10, tokensEarned: 140 });
        expect(await starTokens(player.userId)).toBe(140);
        expect((await player.agent.get(CURRENT)).status).toBe(404);
    }, LONG);

    it('says which button was right after a wrong answer, and resets the streak', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        await answer(player);
        const right = await rightChoice(player.userId);

        const res = await player.agent.post(ANSWER).send({ choice: wrongOf(right) });
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ correct: false, correctChoice: right, tokensEarned: 0, streak: 0, starTokens: 10 });
    });

    it('gives 5 for a right answer with the hint', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        await player.agent.post(HINT);
        const res = await answer(player);
        expect(res.body.data).toMatchObject({ correct: true, tokensEarned: 5, streak: 1 });
    });

    it('puts unseen questions in the next round and pays nothing for repeats', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        for (let i = 0; i < 10; i += 1) await answer(player);
        const firstRound = await db
            .select({ questionId: roundQuestions.questionId })
            .from(roundQuestions)
            .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
            .where(eq(rounds.userId, player.userId));
        const seen = new Set(firstRound.map((row) => row.questionId));

        await player.agent.post(ROUNDS);
        const secondRound = [];
        for (let i = 0; i < 10; i += 1) {
            const { rq } = await currentRow(player.userId);
            secondRound.push(rq.questionId);
            const res = await answer(player);
            // Unseen questions pay; repeats pay nothing, streak bonus included
            expect(res.body.data.tokensEarned > 0).toBe(!seen.has(rq.questionId));
        }
        // 12 questions, 10 seen: the 2 unseen must be in the second round
        expect(secondRound.filter((id) => !seen.has(id))).toHaveLength(QUESTION_COUNT - 10);
    }, LONG * 2);

    it('scores a double click once: the second click gets 409', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const choice = await rightChoice(player.userId);
        await player.agent.post(ANSWER).send({ choice });

        // The next question hasn't been opened, so this can't land on it
        const again = await player.agent.post(ANSWER).send({ choice });
        expect(again.status).toBe(409);
        expect(await starTokens(player.userId)).toBe(10);
    });

    it('scores two answers sent at the same moment once', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const choice = await rightChoice(player.userId);

        const results = await Promise.all([
            player.agent.post(ANSWER).send({ choice }),
            player.agent.post(ANSWER).send({ choice }),
        ]);
        expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
        expect(await starTokens(player.userId)).toBe(10);
        const answered = await db
            .select()
            .from(roundQuestions)
            .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
            .where(and(eq(rounds.userId, player.userId), eq(roundQuestions.correct, true)));
        expect(answered).toHaveLength(1);
    });

    it('keeps the tokens of a round given up', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        await answer(player);
        const res = await player.agent.post(ABANDON);
        expect(res.body.data).toMatchObject({ status: 'abandoned', correctCount: 1, tokensEarned: 10 });
        expect(res.body.data.questions[0].correctAnswer).toEqual(expect.any(String));
        expect(await starTokens(player.userId)).toBe(10);
    });

    it('refuses a choice outside 1 to 3, and answers 404 with no round', async () => {
        const player = await newPlayer();
        expect((await player.agent.post(ANSWER).send({ choice: 1 })).status).toBe(404);
        await player.agent.post(ROUNDS);
        const res = await player.agent.post(ANSWER).send({ choice: 4 });
        expect(res.status).toBe(400);
        expect(res.body.error.details[0].path).toBe('body.choice');
    });
});
```

Remove the `.skip` from `continues where the player left off` (Task 6).

- [ ] **Step 2: Run them to see them fail**

Run from `backend/`: `npx vitest run tests/rounds.test.js`
Expected: the new tests and the unskipped one FAIL with 404 `Not found: POST /api/v1/rounds/current/answer`.

- [ ] **Step 3: Add to `backend/src/lib/rounds.js`**

Change the first import line to:

```js
import { and, asc, eq, isNull, ne, notExists, sql } from 'drizzle-orm';
```

The schema import to:

```js
import { countries, questions, rounds, roundQuestions, scores } from '../db/schema/index.js';
```

And the scoring import to:

```js
import { nextStreak, streakOf, tokensFor } from './scoring.js';
```

At the end of the file, add:

```js
// Whether the player has answered this question right in any round before
async function answeredRightBefore(userId, questionId) {
    const [row] = await db
        .select({ id: roundQuestions.roundQuestionId })
        .from(roundQuestions)
        .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
        .where(and(eq(rounds.userId, userId), eq(roundQuestions.questionId, questionId), eq(roundQuestions.correct, true)))
        .limit(1);
    return Boolean(row);
}

// Checks the answer to the question on screen and adds its tokens. The last answer finishes the
// round and comes back with the results. `choice` is the button, 1 to 3
export async function answerQuestion(userId, choice) {
    const { round, rows } = await activeRound(userId);
    const { rq, question } = openRow(rows);

    const chosenAnswer = rq.answerOrder[choice - 1];
    const correct = chosenAnswer === question.correctAnswer;
    const streak = nextStreak(progress(rows).streak, correct);
    const firstTime = correct && !(await answeredRightBefore(userId, question.questionId));
    const tokens = tokensFor({ correct, firstTime, hintUsed: rq.hintUsed, streak });

    // Saves the answer only while the row is unanswered, and with the hint as it was read. A
    // second request waits for the first, then finds nothing to update, so it adds 0 tokens
    const answered = db.$with('answered').as(
        db.update(roundQuestions)
            .set({ answeredAt: new Date(), chosenAnswer, correct, tokensAwarded: tokens })
            .where(and(
                eq(roundQuestions.roundQuestionId, rq.roundQuestionId),
                isNull(roundQuestions.answeredAt),
                eq(roundQuestions.hintUsed, rq.hintUsed),
            ))
            .returning({ tokensAwarded: roundQuestions.tokensAwarded }),
    );
    const addTokens = db.with(answered)
        .update(scores)
        .set({ starTokens: sql`${scores.starTokens} + ${answered.tokensAwarded}` })
        .from(answered)
        .where(eq(scores.userId, userId))
        .returning({ starTokens: scores.starTokens });
    // Does nothing until every question in the round has been answered
    const finishIfDone = db.update(rounds)
        .set({ status: 'finished', finishedAt: new Date() })
        .where(and(
            eq(rounds.roundId, round.roundId),
            eq(rounds.status, 'active'),
            notExists(db.select().from(roundQuestions).where(and(
                eq(roundQuestions.roundId, round.roundId),
                isNull(roundQuestions.answeredAt),
            ))),
        ));

    const [[added]] = await db.batch([addTokens, finishIfDone]);
    if (!added) throw new AppError(409, 'That question has already been answered');

    const result = {
        correct,
        correctChoice: rq.answerOrder.indexOf(question.correctAnswer) + 1,
        tokensEarned: tokens,
        streak,
        starTokens: added.starTokens,
    };
    const isLast = rq.position === rows.length;
    return isLast ? { ...result, summary: await roundSummary(userId, round.roundId) } : result;
}
```

- [ ] **Step 4: Add the route**

In `backend/src/routes/rounds.routes.js`, change the imports to:

```js
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { answerSchema } from '../validation/rounds.js';
import { startRound, currentRound, useHint, answerQuestion, abandonRound } from '../lib/rounds.js';
```

Before the hint route, add:

```js
// Checks the answer to the question on screen. The body says which button, never which question
roundsRouter.post('/current/answer', validate({ body: answerSchema }), async (req, res) => {
    res.json({ data: await answerQuestion(req.user.userId, req.valid.body.choice) });
});
```

- [ ] **Step 5: Run the tests to see them pass**

Run from `backend/`: `npx vitest run tests/rounds.test.js`
Expected: PASS, 20 tests, none skipped.

**Stop conditions.** These are the outcomes this task exists to prove, so any other result means
stop and tell Slav rather than adjust the test:

- `db.batch()` refuses the `$with` statement, or Neon answers it with an error: the statement
  needs another form. Run `addTokens.toSQL()` and show Slav the SQL
- `scores two answers sent at the same moment once` gives `[200, 200]` or 20 tokens: the one
  statement is not doing what the decisions table says, and the design has to be revisited
- the full round's tokens differ from `[10, 10, 15, ...]`: compare with `scoring.test.js`, which
  already passes on the same rules

- [ ] **Step 6: Lint and ask to commit**

Run from `backend/`: `npm test`, then `npm run lint`. Expected: all pass, no problems.

Explain: the answer route step by step with one real answer (button 2, `answerOrder` `[3, 1, 2]`,
stored answer 1, correct answer 1); the SQL the CTE becomes (`addTokens.toSQL()`); what a row lock
is, with the two-requests timeline; why `finishIfDone` is safe to run on every answer; why the
browser sends a button and not a question id.

Message: `feat: answer questions and score them`

---

### Task 9: A round's results, and the live check

**Files:**

- Modify: `backend/src/routes/rounds.routes.js`
- Test: `backend/tests/rounds.test.js`

- [ ] **Step 1: Write the failing tests**

At the end of `backend/tests/rounds.test.js`, add:

```js
describe('a round\'s results', () => {
    it('shows an ended round to its player only, and never a round in play', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        await answer(player);
        const ended = (await player.agent.post(ABANDON)).body.data.roundId;

        const own = await player.agent.get(`${ROUNDS}/${ended}`);
        expect(own.status).toBe(200);
        expect(own.body.data).toMatchObject({ roundId: ended, status: 'abandoned', correctCount: 1, tokensEarned: 10 });
        expect(own.body.data.questions[0]).toMatchObject({ position: 1, correct: true, country: COUNTRY });

        const other = await newPlayer();
        expect((await other.agent.get(`${ROUNDS}/${ended}`)).status).toBe(404);

        const inPlay = (await player.agent.post(ROUNDS)).body.data.roundId;
        expect((await player.agent.get(`${ROUNDS}/${inPlay}`)).status).toBe(404);
    });

    it('refuses an id that isn\'t a number', async () => {
        const player = await newPlayer();
        expect((await player.agent.get(`${ROUNDS}/abc`)).status).toBe(400);
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run from `backend/`: `npx vitest run tests/rounds.test.js`
Expected: the first FAILS (404 on its own round); the second FAILS (404, not 400).

- [ ] **Step 3: Add the route**

In `backend/src/routes/rounds.routes.js`, change two imports to:

```js
import { answerSchema, roundParamsSchema } from '../validation/rounds.js';
import { startRound, currentRound, useHint, answerQuestion, abandonRound, roundSummary } from '../lib/rounds.js';
```

Before `export default roundsRouter;`, add:

```js
// An ended round's results. After the /current routes, so "current" is never read as an id
roundsRouter.get('/:id', validate({ params: roundParamsSchema }), async (req, res) => {
    res.json({ data: await roundSummary(req.user.userId, req.valid.params.id) });
});
```

- [ ] **Step 4: Run the tests to see them pass**

Run from `backend/`: `npm test`
Expected: every file passes; `rounds.test.js` has 22 tests. Then check the `test` branch is left
empty, from `backend/`:

```bash
node --input-type=module -e "const dotenv = await import('dotenv'); dotenv.config({ quiet: true }); process.env.DB_URL = process.env.TEST_DB_URL; const { db } = await import('./src/db/index.js'); const s = await import('./src/db/schema/index.js'); console.log(await db.\$count(s.users), await db.\$count(s.rounds), await db.\$count(s.questions))"
```

Expected: `0 0 0`. The order matters, as in `tests/setup.js`: `.env` is read first so
`TEST_DB_URL` exists, `DB_URL` is pointed at it, and only then is `db` imported. If it prints `1`
users, it reached `dev`: stop. If anything is left on `test`, find which test's clean-up missed it
before going on.

- [ ] **Step 5: Lint and ask to commit**

Run from `backend/`: `npm run lint`. Expected: no problems.

Message: `feat: show a round's results`

- [ ] **Step 6: The live check**

Start the API in the background from `backend/`: `npm run dev`. Wait for its start-up line.

Write the script to the scratchpad (not the repo) as `live-check.mjs`:

```js
const BASE = 'http://localhost:5600/api/v1';
// A browser's user agent: Arcjet blocks a script's own as a bot
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
let cookie = '';

async function call(method, path, body) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
        body: body && JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
}

const stamp = Date.now() % 100000;
const account = (domain) => ({ name: `Check${stamp}`, email: `wq-check-${stamp}@${domain}`, password: 'live-check-password' });

const disposable = await call('POST', '/auth/sign-up', account('mailinator.com'));
console.log('disposable sign-up', disposable.status, JSON.stringify(disposable.body.error));
if (disposable.status !== 400) process.exit(1);

const signUp = await call('POST', '/auth/sign-up', account('outlook.com'));
console.log('sign-up', signUp.status, signUp.body.data?.email);
if (signUp.status !== 201) process.exit(1);

const start = await call('POST', '/rounds');
console.log('start', start.status, `${start.body.data.position} of ${start.body.data.total}`, start.body.data.question);
console.log('hint', (await call('POST', '/rounds/current/hint')).body.data);
const first = await call('POST', '/rounds/current/answer', { choice: 1 });
console.log('answer', first.status, first.body.data);
console.log('answer again before opening the next', (await call('POST', '/rounds/current/answer', { choice: 1 })).status);
const next = await call('GET', '/rounds/current');
console.log('next', next.status, `${next.body.data.position} of ${next.body.data.total}`);
const abandon = await call('POST', '/rounds/current/abandon');
console.log('give up', abandon.status, abandon.body.data.status, abandon.body.data.tokensEarned);
console.log('results', (await call('GET', `/rounds/${abandon.body.data.roundId}`)).status);
```

Run: `node <scratchpad>/live-check.mjs`

Expected: disposable sign-up `400` with `body.email`; sign-up `201`; start `201`, `1 of 10`, a
Cloudinary `imageUrl` and three answers; a hint; answer `200`, with `tokensEarned` 5 or 0
(`choice: 1` is right one time in three); answering again `409`; next `2 of 10`; give up `200`
`abandoned`; results `200`. Open the `imageUrl` in the browser: the photo loads.

If the disposable sign-up gets 201, the script stops there: Arcjet didn't refuse it. Tell Slav;
that one account then needs removing in Step 7.

- [ ] **Step 7: Stop the server and remove the live-check account**

Stop nodemon and the server by process ID (`Resources/Gotchas.md`: stopping the background task
leaves both holding port 5600). Check port 5600 is free.

**Ask Slav before deleting.** Then, from `backend/`:

```bash
node --input-type=module -e "const { like } = await import('drizzle-orm'); const { db } = await import('./src/db/index.js'); const { users } = await import('./src/db/schema/index.js'); console.log(await db.delete(users).where(like(users.email, 'wq-check-%')).returning({ email: users.email }))"
```

Expected: one email listed. Its score, session and round go with it (cascade). `dev` is back to 1
user.

---

### Task 10: Rules and the learning note

**Files:**

- Modify: `.claude/rules/api.md`, `.claude/rules/backend.md`, `.claude/rules/testing.md`
- Create: `docs/learning/03-core-game.md`

- [ ] **Step 1: `api.md`**

Add a row to the routing table:

```markdown
| `/api/v1/rounds` | `routes/rounds.routes.js`, players only: `POST /`, `GET /current`, `POST /current/hint`, `POST /current/answer`, `POST /current/abandon`, `GET /:id` |
```

Under `## Responses and errors`, add:

```markdown
- **Play routes** act on the player's one active round, so the browser never names a question. An
  answer is a button (`{ choice: 1-3 }`); the server maps it through the round's `answer_order`.
  A question must be opened with `GET /current` before it can be answered or hinted (409 if not)
```

- [ ] **Step 2: `backend.md`**

In the layout, replace the `db/schema/` and `lib/` lines with:

```text
│   ├── db/schema/          users.js (roleEnum, users, scores), quiz.js (countries, questions),
│   │                       auth.js (sessions), game.js (roundStatusEnum, rounds, roundQuestions),
│   │                       index.js
│   ├── lib/                errors.js (AppError, fieldError, isUniqueViolation), passwords.js,
│   │                       tokens.js, sessions.js, accounts.js (publicUser, createPlayer),
│   │                       scoring.js and picking.js (pure game rules), rounds.js (the game)
```

Under `## Schema conventions (Drizzle)`, after the `db.batch` item, add:

```markdown
- A write that must happen only once, however many requests arrive, puts its condition in the
  `UPDATE`'s `WHERE` (`answered_at IS NULL`). When a second table depends on whether that update
  saved a row, both go in one statement: `db.$with('x').as(db.update(...).returning(...))`, then
  `db.with(x).update(other).from(x)`. A separate statement in the same batch can't tell
```

- [ ] **Step 3: `testing.md`**

Under `## Backend`, add:

```markdown
- Test files run one at a time (`fileParallelism: false`): a round picks from every question on
  the `test` branch, so a file adding questions mustn't run beside one playing rounds
- Code that must hold under two requests at once is tested by sending both with `Promise.all`
  and checking the statuses and the database afterwards (`rounds.test.js`)
```

- [ ] **Step 4: Write `docs/learning/03-core-game.md`**

Same shape as `02-auth.md`: one section per file in the order they were written (test settings,
schema, scoring, picking, validation, starting and showing, hint and giving up, answering,
results), each with what it does, inputs and outputs, where it's used and a walk-through with real
data. Then:

- **How the files connect**, as a `text` diagram: button press → `POST /current/answer` →
  `validate` → `answerQuestion` → `activeRound` → `openRow` → `scoring.js` → one batch
  (`addTokens` with its CTE, `finishIfDone`) → response
- **One round end to end:** Maria presses Play, takes the hint on question 2, gets question 5
  wrong and finishes with the spec's worked example: 9 / 10, 110 tokens
- **Two clicks, one answer:** the row-lock timeline as a table, request A and request B side by
  side
- **Check yourself:** six questions, among them why the browser sends a button and not the
  answer, why the streak is never stored, what would go wrong with the scores update as a
  separate statement, and why a round in play has no results page

- [ ] **Step 5: Lint the markdown**

Run from the repo root: `markdownlint-cli2 ".claude/rules/*.md" "docs/learning/*.md" "docs/superpowers/plans/*.md"`
Expected: `Summary: 0 issues in 0 files`.

- [ ] **Step 6: Ask to commit**

Message: `docs: add the phase 2b rules and learning note`

---

## Done when

- `npm test` passes with every new test, and the `test` branch holds no users, rounds or
  questions afterwards
- Two answers sent at once are scored once, proven by the test, not assumed
- The live check shows a disposable sign-up refused with 400, and a round started, hinted,
  answered, refused a second answer, given up and summed up on `dev` with Arcjet on; the
  live-check account removed afterwards on Slav's yes
- Both Neon branches record migrations `0000` to `0002`, and `scores` has no `saved_question_id`
- `docs/learning/03-core-game.md` exists and Slav has the check-yourself questions
- Every commit was asked for and approved
