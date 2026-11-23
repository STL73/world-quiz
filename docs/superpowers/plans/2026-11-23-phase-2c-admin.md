# Phase 2c: Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task, inline, with Slav in the loop. Steps use checkbox (`- [ ]`) syntax for
> tracking. Subagent-driven execution is not used: every file is explained to Slav before the next
> one is written.

**Goal:** an admin can list, search, add (with a photo), edit, preview, hide, unhide and delete
questions, and list and delete players; a played question can only be hidden, and new rounds never
pick a hidden one; tests prove all of it.

**Architecture:** one migration adds `questions.hidden_at` and makes country names unique whatever
their capitals. `lib/photos.js` is the only file that talks to Cloudinary, and the `multer`
middleware in `middleware/upload.js` is the only one that reads a file. `lib/questions.js` and
`lib/users.js` hold the database steps; three thin routers under `/api/v1/admin/` sit over them,
each behind `requireAuth, requireRole('admin')`.

**Tech stack:** Express 5, multer 2.5.0 (new), Cloudinary SDK 2, Drizzle ORM 0.45.4 on `neon-http`,
drizzle-kit 0.31.11, Zod 4.6.7, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-11-17-core-game-design.md` gives 2c one row in its phase
table and one rule ("admin CRUD hides questions instead"). Everything else below was decided with
Slav on 2026-11-23 or is marked **new**.

---

## Decisions

The first four were Slav's answers on 2026-11-23. The rows marked **new** go further, and need
Slav's yes before Task 1 starts.

| Decision | Choice | Why |
| --- | --- | --- |
| Deleting a played question | Delete removes a question no round has used. A played one answers 409, and the admin hides it instead. Hidden questions can be unhidden | `round_questions.question_id` is `ON DELETE RESTRICT`, so old results keep their questions. The database refuses the delete (`23001`), so a round started a second earlier still counts |
| Admin preview mode | `GET /admin/questions/:id/preview`: the question as a player sees it (photo, text, the three answers shuffled, the hint) plus the right button. No round, no tokens | Small, and phase 4 uses it to show how a question will look |
| Photos | Image upload moves from phase 8 into 2c: add and edit take a `photo` file, through multer to Cloudinary | Without it an admin can't add a whole question. Phase 8 disappears from the phase table; 2c grows from 2–3 sessions to 3–5 |
| User admin | List users (tokens and level, searchable, paginated) and delete a player | PHP parity. Role changes and token edits were not chosen |
| **New:** how hiding is stored | A nullable `hidden_at` timestamp on `questions`, not a boolean | It also says when; `NULL` means visible |
| **New:** a hidden question in a round already in play | Stays in that round and can be answered | Taking it out would break the round's positions. Only new rounds skip it |
| **New:** countries in the question form | The form sends the country's name. The server finds it whatever the capitals, or creates it. `GET /admin/countries` lists them for the form's suggestions | The admin never has to know an id. Countries with no questions left stay; they cost nothing |
| **New:** country names unique whatever the capitals | The migration swaps `countries.name`'s UNIQUE for a UNIQUE index on `lower(name)` | Otherwise "france" typed at the same moment as "France" could make two. Same pattern as player names |
| **New:** the three answers must differ | `questionSchema` refuses two answers that match, ignoring capitals, under `body.answers` | Two identical buttons would make a question unfair |
| **New:** editing a played question | Allowed, text and right answer included | Fixing a typo is the usual reason. Old results show the question as it is now; `correct` and `tokens_awarded` keep what was scored at the time |
| **New:** photo rules | JPEG, PNG or WebP, 5 MB at most, one file, field `photo`. Resized to at most 1600 px wide, as the import did | Phone photos fit under 5 MB; 1600 px is plenty for a quiz card |
| **New:** the order of photo and row | Upload first, then write the row. If the row fails, the new photo is deleted. An edit's old photo is deleted only after the row points at the new one | A row never points at a missing photo. A failed photo delete is logged, not thrown: the database has already changed, and a leftover photo costs only storage |
| **New:** whom an admin can delete | Players only. An admin account (including their own) is a 403 | No admin can lock everyone out. Admins come from the seed script |
| **New:** search | `?search=` matches the question text or the country name (questions), or the name or email (users), case-insensitive, with `%` and `_` taken literally | Without escaping, typing `%` would match everything |
| **New:** list size | `?page=` from 1, `?limit=` 1 to 100, default 20 | `api.md`'s list shape: `{ data, pagination }` |
| **New:** the level | `levelFor(starTokens)` = `floor(starTokens / 100) + 1` in `scoring.js` | The spec's formula, needed for the first time here. Admins have no score row, so their tokens and level are `null` |
| **New:** Cloudinary in tests | `vi.spyOn(cloudinary.uploader, 'upload')` and `'destroy'` | `photos.js` and the routes then run for real, and nothing reaches Cloudinary. `testing.md` gets a line |

Confidence: high on the database steps, which reuse patterns already proven in 2a and 2b. Medium on
two library details nothing here has run yet: `vi.spyOn` on the Cloudinary SDK's `uploader` object
(Task 4 checks it first; the fallback is `vi.mock('../src/lib/photos.js')` in the route tests), and
Zod reading multer's `req.body`, which has no prototype (Task 6's first test shows it; the fallback
is `{ ...req.body }` in `photoUpload`).

## How every task runs

1. Write one file
2. **Explain it to Slav** (the points are listed in each task): what each function does, what goes
   in and comes out, where it's used, a walk-through with real data, and an analogy where it helps.
   Wait until Slav is ready before the next file
3. After the last step of a task, add that task's explanation to `docs/learning/04-admin.md`
   (Task 10 lists the sections)
4. **Commit only after asking Slav and getting a clear yes.** Every commit step below means: show
   the files, propose the message, ask, wait. Push is a separate question

Code style: backend uses single quotes and 4-space indents. Comments follow the standard: one plain
line above each exported function or table, and a "why" only when the code can't show it.

Every name a test file declares is added in the task that first uses it, so the file passes
ESLint's `no-unused-vars` at every task, not only the last.

Local live checks: send a browser user agent (see `api.md`).

## File map

| File | Responsibility |
| --- | --- |
| `backend/src/db/schema/quiz.js` | `questions.hiddenAt`; countries unique on `lower(name)` |
| `backend/drizzle/0003_hide_questions.sql` | The generated migration (committed) |
| `backend/src/lib/rounds.js` | `startRound` picks only visible questions |
| `backend/src/lib/scoring.js` | `levelFor` |
| `backend/src/lib/errors.js` | `isRestrictViolation` |
| `backend/src/lib/lists.js` | `containsPattern`, `pagination` |
| `backend/src/validation/common.js` | `idParamsSchema` |
| `backend/src/validation/rounds.js` | `roundParamsSchema` becomes `idParamsSchema` |
| `backend/src/validation/admin.js` | `listQuerySchema`, `questionSchema` |
| `backend/src/middleware/upload.js` | `photoUpload` (multer) |
| `backend/src/lib/photos.js` | `uploadQuestionPhoto`, `deletePhoto` |
| `backend/src/lib/questions.js` | List, get, preview, create, update, delete, hide questions; list countries |
| `backend/src/lib/users.js` | `listUsers`, `deleteUser` |
| `backend/src/routes/adminQuestions.routes.js` | `/api/v1/admin/questions` |
| `backend/src/routes/adminCountries.routes.js` | `/api/v1/admin/countries` |
| `backend/src/routes/adminUsers.routes.js` | `/api/v1/admin/users` |
| `backend/src/app.js` | Mounts the three admin routers |
| `backend/tests/photos.test.js`, `adminQuestions.test.js`, `adminUsers.test.js` | New tests |
| `backend/tests/schema.test.js`, `rounds.test.js`, `scoring.test.js`, `validation.test.js` | Added tests |

---

### Task 1: Schema: hiding questions, and country names whatever the capitals

**Files:**

- Modify: `backend/src/db/schema/quiz.js`
- Create: `backend/drizzle/0003_hide_questions.sql` (generated)
- Test: `backend/tests/schema.test.js`

- [ ] **Step 1: Write the failing tests**

Add inside `describe('database schema', ...)` in `tests/schema.test.js`, after the last `it`:

```js
    it('starts a question visible', async () => {
        const question = await addTestQuestion();
        expect(question.hiddenAt).toBeNull();
    });

    it('refuses a second country whose name differs only in capitals', async () => {
        await addTestQuestion();
        const error = await db.insert(countries).values({ name: TEST_COUNTRY.toUpperCase() }).catch((e) => e);
        expect(error.cause.code).toBe('23505');
    });
```

`afterEach` already deletes `TEST_COUNTRY`; the upper-case copy is refused, so nothing else is left.

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- tests/schema.test.js`
Expected: FAIL. `hiddenAt` is `undefined`, not `null`, and the upper-case insert succeeds, so
`error.cause` is undefined. (If the second insert succeeded, delete `SCHEMA TESTLAND` from the
`test` branch by hand before going on.)

- [ ] **Step 3: Change the schema**

`src/db/schema/quiz.js`, whole file:

```js
import { sql } from 'drizzle-orm';
import { pgTable, integer, varchar, smallint, timestamp, index, check, uniqueIndex } from 'drizzle-orm/pg-core';

// A country the landmarks belong to
export const countries = pgTable('countries', {
    countryId: integer('country_id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 100 }).notNull(),
}, (table) => [
    // On lower(name), so an admin typing "france" finds France instead of making a second one
    uniqueIndex('countries_name_lower_unique').on(sql`lower(${table.name})`),
]);

// One landmark photo and its three possible answers
export const questions = pgTable('questions', {
    questionId: integer('question_id').primaryKey().generatedAlwaysAsIdentity(),
    // A country can't be deleted while it still has questions
    countryId: integer('country_id').notNull().references(() => countries.countryId, { onDelete: 'restrict' }),
    imageUrl: varchar('image_url', { length: 500 }).notNull(),
    // Cloudinary's name for the photo, so a replaced one can be deleted
    cloudinaryId: varchar('cloudinary_id', { length: 255 }).notNull(),
    question: varchar('question', { length: 150 }).notNull(),
    hint: varchar('hint', { length: 150 }).notNull(),
    answer1: varchar('answer1', { length: 100 }).notNull(),
    answer2: varchar('answer2', { length: 100 }).notNull(),
    answer3: varchar('answer3', { length: 100 }).notNull(),
    // One number instead of three true/false flags, so exactly one answer is always right
    correctAnswer: smallint('correct_answer').notNull(),
    // Set while new rounds leave the question out. A played question can't be deleted, so it's hidden
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
}, (table) => [
    check('questions_correct_answer_range', sql`${table.correctAnswer} BETWEEN 1 AND 3`),
    // Postgres doesn't index a foreign key by itself; finding a country's questions needs one
    index('questions_country_id_idx').on(table.countryId),
]);
```

- [ ] **Step 4: Generate the migration and show Slav the SQL**

Run from `backend/`: `npx drizzle-kit generate --name hide_questions`

Expected: `drizzle/0003_hide_questions.sql` containing, in some order:

```sql
ALTER TABLE "countries" DROP CONSTRAINT "countries_name_unique";
ALTER TABLE "questions" ADD COLUMN "hidden_at" timestamp with time zone;
CREATE UNIQUE INDEX "countries_name_lower_unique" ON "countries" USING btree (lower("name"));
```

If drizzle-kit asks whether a column was renamed, choose "create column". **Show Slav the file and
wait for his yes before applying it.**

- [ ] **Step 5: Apply it to both branches**

```bash
npx drizzle-kit migrate
DB_TARGET=test npx drizzle-kit migrate
```

Expected: both finish without an error. `dev`'s 16 countries already differ in more than capitals,
so the new index builds. If it fails with `23505`, stop: two countries on `dev` clash, and Slav
decides which to keep.

- [ ] **Step 6: Run the tests to see them pass**

Run: `npm test`
Expected: PASS, every file (98 tests before this task, 100 now).

- [ ] **Step 7: Commit (ask Slav first)**

```bash
git add src/db/schema/quiz.js drizzle/ tests/schema.test.js
git commit -m "feat: let questions be hidden, and match countries whatever the capitals"
```

**Explain to Slav:** why a timestamp rather than a true/false; what `NULL` means here; why the
index is on `lower(name)` (the same trick as player names in 2a); why the old UNIQUE constraint is
dropped rather than kept beside it.

---

### Task 2: New rounds skip hidden questions

**Files:**

- Modify: `backend/src/lib/rounds.js:12-14`
- Test: `backend/tests/rounds.test.js`

- [ ] **Step 1: Write the failing test**

In `tests/rounds.test.js`, change the drizzle import line to:

```js
import { and, asc, eq, inArray, isNull, like } from 'drizzle-orm';
```

and add at the end of the file:

```js
describe('hidden questions', () => {
    it('leaves hidden questions out of a new round', async () => {
        const hidden = (await db
            .select({ questionId: questions.questionId })
            .from(questions)
            .where(eq(questions.cloudinaryId, CLOUDINARY_ID))
            .orderBy(asc(questions.questionId))
            .limit(3)).map((row) => row.questionId);
        await db.update(questions).set({ hiddenAt: new Date() }).where(inArray(questions.questionId, hidden));
        try {
            const player = await newPlayer();
            const res = await player.agent.post(ROUNDS);
            // 12 questions, 3 hidden: 9 left, fewer than a full round
            expect(res.body.data.total).toBe(9);
            const rows = await db.select().from(roundQuestions).where(eq(roundQuestions.roundId, res.body.data.roundId));
            for (const row of rows) expect(hidden).not.toContain(row.questionId);
        } finally {
            // Later tests in this file expect all 12
            await db.update(questions).set({ hiddenAt: null }).where(inArray(questions.questionId, hidden));
        }
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- tests/rounds.test.js -t "hidden"`
Expected: FAIL, `expected 10 to be 9`.

- [ ] **Step 3: Pick only visible questions**

In `src/lib/rounds.js`, the first line of `startRound` becomes:

```js
    const all = await db.select({ questionId: questions.questionId }).from(questions).where(isNull(questions.hiddenAt));
```

`isNull` is already imported. Change the comment above `startRound` to:

```js
// Starts a round from the questions not hidden: picks them and shuffles each one's answers. 409 if one is in play
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- tests/rounds.test.js`
Expected: PASS, every test in the file.

- [ ] **Step 5: Commit (ask Slav first)**

```bash
git add src/lib/rounds.js tests/rounds.test.js
git commit -m "feat: leave hidden questions out of new rounds"
```

**Explain to Slav:** that a hidden question in a round already in play stays playable, and why
(the round's positions are fixed when it starts); why the test unhides in `finally`.

---

### Task 3: Small shared pieces: the level, a restrict error, list helpers and validation

**Files:**

- Modify: `backend/src/lib/scoring.js`, `backend/src/lib/errors.js`, `backend/src/validation/rounds.js`
- Create: `backend/src/lib/lists.js`, `backend/src/validation/common.js`, `backend/src/validation/admin.js`
- Test: `backend/tests/scoring.test.js`, `backend/tests/validation.test.js`, `backend/tests/lists.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/scoring.test.js`: change the import to
`import { levelFor, nextStreak, streakOf, tokensFor } from '../src/lib/scoring.js';` and add at the end:

```js
describe('levelFor', () => {
    it('starts at level 1 and goes up one level every 100 tokens', () => {
        expect(levelFor(0)).toBe(1);
        expect(levelFor(99)).toBe(1);
        expect(levelFor(100)).toBe(2);
        expect(levelFor(650)).toBe(7);
    });
});
```

`tests/lists.test.js` (new):

```js
import { describe, it, expect } from 'vitest';

import { containsPattern, pagination } from '../src/lib/lists.js';

describe('containsPattern', () => {
    it('matches the text anywhere, taking LIKE wildcards literally', () => {
        expect(containsPattern('paris')).toBe('%paris%');
        expect(containsPattern('100%_sure\\')).toBe('%100\\%\\_sure\\\\%');
    });
});

describe('pagination', () => {
    it('works out the number of pages', () => {
        expect(pagination(2, 20, 46)).toEqual({ page: 2, limit: 20, total: 46, totalPages: 3 });
        expect(pagination(1, 20, 0)).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    });
});
```

`tests/validation.test.js`: add `import { listQuerySchema, questionSchema } from '../src/validation/admin.js';`
and `import { idParamsSchema } from '../src/validation/common.js';` under the existing imports, and
at the end:

```js
describe('idParamsSchema', () => {
    it('is the same rule as a round id', () => {
        expect(roundParamsSchema).toBe(idParamsSchema);
    });
});

describe('listQuerySchema', () => {
    it('defaults to the first page of 20 and turns text into numbers', () => {
        expect(listQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
        expect(listQuerySchema.parse({ page: '3', limit: '50', search: '  paris ' }))
            .toEqual({ page: 3, limit: 50, search: 'paris' });
    });

    it('refuses a page below 1 and a limit above 100', () => {
        expect(listQuerySchema.safeParse({ page: '0' }).success).toBe(false);
        expect(listQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
        expect(listQuerySchema.safeParse({ page: 'two' }).success).toBe(false);
    });
});

describe('questionSchema', () => {
    const valid = {
        country: ' France ',
        question: 'Which tower is this?',
        hint: 'Built for a world fair',
        answer1: 'Eiffel Tower',
        answer2: 'Tokyo Tower',
        answer3: 'Blackpool Tower',
        correctAnswer: '1',
    };

    it('trims the text and turns the right answer into a number, as a form sends it', () => {
        expect(questionSchema.parse(valid)).toEqual({ ...valid, country: 'France', correctAnswer: 1 });
    });

    it('lists every problem under its field', () => {
        const result = questionSchema.safeParse({ ...valid, hint: '  ', correctAnswer: '4' });
        expect(result.error.issues.map((issue) => issue.path.join('.')).sort()).toEqual(['correctAnswer', 'hint']);
    });

    it('refuses two answers that differ only in capitals', () => {
        const result = questionSchema.safeParse({ ...valid, answer3: 'eiffel tower' });
        expect(result.error.issues).toEqual([expect.objectContaining({ path: ['answers'], message: 'Each answer must be different.' })]);
    });

    it('refuses text longer than its column', () => {
        expect(questionSchema.safeParse({ ...valid, question: 'x'.repeat(151) }).success).toBe(false);
        expect(questionSchema.safeParse({ ...valid, answer1: 'x'.repeat(101) }).success).toBe(false);
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- tests/scoring.test.js tests/lists.test.js tests/validation.test.js`
Expected: FAIL: `levelFor` is not exported, and `lists.js`, `admin.js` and `common.js` don't exist.

- [ ] **Step 3: Write the code**

`src/lib/scoring.js`, under the existing constants:

```js
const TOKENS_PER_LEVEL = 100;
```

and at the end:

```js
// The level a number of tokens reaches: 0 to 99 is level 1, 100 to 199 level 2
export const levelFor = (starTokens) => Math.floor(starTokens / TOKENS_PER_LEVEL) + 1;
```

`src/lib/errors.js`, at the end:

```js
// A delete refused by ON DELETE RESTRICT: another table still uses the row
export const isRestrictViolation = (error) => (error.code ?? error.cause?.code) === '23001';
```

`src/lib/lists.js` (new):

```js
// Search text for ILIKE, found anywhere in the column. LIKE's own wildcards are escaped, so a
// typed % or _ matches only itself
export const containsPattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

// The page details every list answers with
export const pagination = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
```

`src/validation/common.js` (new):

```js
import { z } from 'zod';

// An id from the address, which always arrives as text. Postgres integers end at 2147483647
export const idParamsSchema = z.object({
    id: z.coerce.number().int().positive().max(2147483647),
});
```

`src/validation/rounds.js`: replace the `roundParamsSchema` block (comment included) with

```js
// A round id from the address
export { idParamsSchema as roundParamsSchema } from './common.js';
```

`src/validation/admin.js` (new):

```js
import { z } from 'zod';

// One page of a list: ?page=2&limit=20&search=paris. Query values always arrive as text
export const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
});

const CORRECT_MESSAGE = 'Choose which answer is right: 1, 2 or 3.';

// Required text that fits its database column
const text = (label, max) => z
    .string({ error: `Enter ${label}.` })
    .trim()
    .min(1, `Enter ${label}.`)
    .max(max, `Use ${max} characters or fewer.`);

// A question as the add and edit forms send it. The photo is checked separately, by multer
export const questionSchema = z.object({
    country: text('the country', 100),
    question: text('the question', 150),
    hint: text('a hint', 150),
    answer1: text('answer 1', 100),
    answer2: text('answer 2', 100),
    answer3: text('answer 3', 100),
    // A form sends "2"; coerce turns it into 2
    correctAnswer: z.coerce.number({ error: CORRECT_MESSAGE }).int(CORRECT_MESSAGE).min(1, CORRECT_MESSAGE).max(3, CORRECT_MESSAGE),
}).refine(
    ({ answer1, answer2, answer3 }) => new Set([answer1, answer2, answer3].map((a) => a.toLowerCase())).size === 3,
    { path: ['answers'], message: 'Each answer must be different.' },
);
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test` and `npm run lint`
Expected: PASS everywhere; lint clean. The existing `roundParamsSchema` tests still pass unchanged.

- [ ] **Step 5: Commit (ask Slav first)**

```bash
git add src/lib/scoring.js src/lib/errors.js src/lib/lists.js src/validation/ tests/scoring.test.js tests/lists.test.js tests/validation.test.js
git commit -m "feat: add the level, list helpers and admin validation"
```

**Explain to Slav:** what an escape character is, with `100%` as the example; why
`z.coerce` is needed for query strings and form fields but not for JSON; why the "different answers"
rule is a `refine` on the whole object rather than on one field; why `roundParamsSchema` became a
re-export instead of a copy.

---

### Task 4: Photos: multer and Cloudinary

**Files:**

- Modify: `backend/package.json` (multer)
- Create: `backend/src/middleware/upload.js`, `backend/src/lib/photos.js`
- Test: `backend/tests/photos.test.js`

- [ ] **Step 1: Install multer**

Run from `backend/`: `npm install multer@2.5.0`
Expected: `package.json` lists `"multer": "^2.5.0"` under `dependencies`. Run `npm test` once to
check the lockfile didn't break Vitest (the npm 11.5.2 bug in `Resources/Gotchas.md`); if it did,
delete `node_modules` and `package-lock.json` and run `npm install` again.

- [ ] **Step 2: Write the failing test**

`tests/photos.test.js` (new):

```js
import { describe, it, expect, vi, afterEach } from 'vitest';

import { cloudinary } from '../src/config/cloudinary.js';
import { uploadQuestionPhoto, deletePhoto } from '../src/lib/photos.js';

// The spies replace the SDK's own functions, so nothing here reaches Cloudinary
afterEach(() => vi.restoreAllMocks());

const FILE = { mimetype: 'image/jpeg', buffer: Buffer.from('not really a jpeg') };

describe('uploadQuestionPhoto', () => {
    it('sends the photo from memory into the questions folder, resized, and returns its address and name', async () => {
        const upload = vi.spyOn(cloudinary.uploader, 'upload')
            .mockResolvedValue({ public_id: 'world-quiz/test/questions/abc123', version: 1700000000 });

        const photo = await uploadQuestionPhoto(FILE);

        expect(upload).toHaveBeenCalledWith(
            `data:image/jpeg;base64,${FILE.buffer.toString('base64')}`,
            { folder: 'world-quiz/test/questions', resource_type: 'image', transformation: [{ width: 1600, crop: 'limit' }] },
        );
        expect(photo).toEqual({
            imageUrl: expect.stringMatching(/\/f_auto,q_auto\/v1700000000\/world-quiz\/test\/questions\/abc123$/),
            cloudinaryId: 'world-quiz/test/questions/abc123',
        });
    });

    it('turns a file Cloudinary can\'t read as an image into a 400 under the photo field', async () => {
        vi.spyOn(cloudinary.uploader, 'upload').mockRejectedValue({ http_code: 400, message: 'Invalid image file' });
        await expect(uploadQuestionPhoto(FILE)).rejects.toMatchObject({
            status: 400,
            details: [{ path: 'body.photo', message: "This file can't be read as a photo. Please choose another." }],
        });
    });

    it('lets any other failure through as it is, so it becomes a 500', async () => {
        const outage = new Error('Cloudinary is down');
        vi.spyOn(cloudinary.uploader, 'upload').mockRejectedValue(outage);
        await expect(uploadQuestionPhoto(FILE)).rejects.toBe(outage);
    });
});

describe('deletePhoto', () => {
    it('removes the photo and clears it from Cloudinary\'s cache', async () => {
        const destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
        await deletePhoto('world-quiz/test/questions/abc123');
        expect(destroy).toHaveBeenCalledWith('world-quiz/test/questions/abc123', { resource_type: 'image', invalidate: true });
    });

    it('logs a failure instead of throwing it', async () => {
        vi.spyOn(cloudinary.uploader, 'destroy').mockRejectedValue(new Error('Cloudinary is down'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(deletePhoto('world-quiz/test/questions/abc123')).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npm test -- tests/photos.test.js`
Expected: FAIL, `src/lib/photos.js` doesn't exist. **Then check the spy itself works** by
temporarily writing `photos.js` as
`export const uploadQuestionPhoto = async () => {}; export const deletePhoto = async () => {};`:
the first test must now fail on `toHaveBeenCalledWith`, not with `Cannot redefine property`. If
`vi.spyOn` can't replace `cloudinary.uploader.upload`, stop and tell Slav: the fallback is
`vi.mock('../src/lib/photos.js')` in the route tests, and this file then tests `photos.js` through
`vi.mock('cloudinary')`.

- [ ] **Step 4: Write `photos.js`**

`src/lib/photos.js` (new):

```js
import { cloudinary, questionImageFolder, questionImageUrl } from '../config/cloudinary.js';
import { fieldError } from './errors.js';

// Sends a question photo held in memory to Cloudinary. Returns the address to show and Cloudinary's name for it
export async function uploadQuestionPhoto(file) {
    // A data URI carries the bytes straight from memory, so the server never writes a temporary file
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    try {
        const result = await cloudinary.uploader.upload(dataUri, {
            // Passed apart from the name, so the Media Library shows the photo in its folder
            folder: questionImageFolder,
            resource_type: 'image',
            transformation: [{ width: 1600, crop: 'limit' }],
        });
        return { imageUrl: questionImageUrl(result), cloudinaryId: result.public_id };
    } catch (error) {
        // Cloudinary answers 400 for a file whose bytes aren't an image, whatever its type said
        if (error.http_code === 400) {
            throw fieldError(400, 'photo', "This file can't be read as a photo. Please choose another.");
        }
        throw error;
    }
}

// Removes a photo no question uses any more. A failure is logged, not thrown: the database has
// already changed, and a leftover photo costs only storage
export async function deletePhoto(cloudinaryId) {
    try {
        await cloudinary.uploader.destroy(cloudinaryId, { resource_type: 'image', invalidate: true });
    } catch (error) {
        console.warn(`Could not delete photo ${cloudinaryId}:`, error.message);
    }
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `npm test -- tests/photos.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Write the upload middleware**

`src/middleware/upload.js` (new). It is tested through the routes in Task 6:

```js
import multer from 'multer';

import { fieldError } from '../lib/errors.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const parsePhotoForm = multer({
    // Kept in memory: it goes straight on to Cloudinary, so it never needs a file on the server
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 20 },
    fileFilter: (req, file, done) => {
        if (PHOTO_TYPES.includes(file.mimetype)) return done(null, true);
        done(fieldError(400, 'photo', 'Choose a JPEG, PNG or WebP photo.'));
    },
}).single('photo');

// Reads a form with one optional `photo` file: the file onto req.file, the text fields onto req.body.
// A request sent as JSON passes through untouched
export function photoUpload(req, res, next) {
    parsePhotoForm(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Choose a photo of 5 MB or less.'
                : 'Send one photo, in the photo field.';
            return next(fieldError(400, 'photo', message));
        }
        next(error);
    });
}
```

- [ ] **Step 7: Lint, then commit (ask Slav first)**

Run: `npm run lint`. Expected: clean.

```bash
git add package.json package-lock.json src/lib/photos.js src/middleware/upload.js tests/photos.test.js
git commit -m "feat: upload question photos to Cloudinary"
```

**Explain to Slav:** what `multipart/form-data` is and why JSON can't carry a file; memory storage
against disk storage; what a data URI is; why the type check in multer isn't enough on its own
(the browser reports the type, and the bytes could be anything), and why Cloudinary's 400 covers
that; why `deletePhoto` swallows its error and `uploadQuestionPhoto` doesn't; what `vi.spyOn` does
and how it differs from `vi.mock`.

---

### Task 5: Reading questions as an admin: list, detail, preview, countries

**Files:**

- Create: `backend/src/lib/questions.js`, `backend/src/routes/adminQuestions.routes.js`,
  `backend/src/routes/adminCountries.routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/adminQuestions.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/adminQuestions.test.js` (new):

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, countries, questions } from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/passwords.js';

// Everything made here is recognisable, so afterAll can remove it all. Photos the routes "upload"
// in later tests get names containing CLOUDINARY_ID too
const PREFIX = 'admin-q-test-';
const COUNTRY = 'Admin Testland';
const CLOUDINARY_ID = 'admin-q-test';
const PASSWORD = 'correct-horse-battery';

const QUESTIONS = '/api/v1/admin/questions';
const COUNTRIES = '/api/v1/admin/countries';

let admin;
let player;
let seeded;

let count = 0;
function newAccount() {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `AdminQ${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD };
}

// Admins can't sign up, so one is written straight into the table, then logs in like a browser
async function newAdmin() {
    const account = newAccount();
    await db.insert(users).values({
        name: account.name,
        email: account.email,
        passwordHash: await hashPassword(PASSWORD),
        role: 'admin',
    });
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email: account.email, password: PASSWORD });
    return agent;
}

beforeAll(async () => {
    const [country] = await db.insert(countries).values({ name: COUNTRY }).returning();
    seeded = await db.insert(questions).values([0, 1, 2].map((i) => ({
        countryId: country.countryId,
        imageUrl: `https://example.com/admin-q-test-${i}.jpg`,
        cloudinaryId: CLOUDINARY_ID,
        question: `Admin test question ${i}`,
        hint: `Admin test hint ${i}`,
        answer1: `A${i} one`,
        answer2: `A${i} two`,
        answer3: `A${i} three`,
        correctAnswer: (i % 3) + 1,
    }))).returning();
    admin = await newAdmin();
    player = request.agent(app);
    await player.post('/api/v1/auth/sign-up').send(newAccount());
});

afterAll(async () => {
    // Rounds go with their players; only then can played questions be deleted
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
    await db.delete(questions).where(like(questions.cloudinaryId, `%${CLOUDINARY_ID}%`));
    await db.delete(countries).where(like(countries.name, 'Admin Test%'));
});

describe('who may use the admin question routes', () => {
    it('needs a login, and turns players away', async () => {
        expect((await request(app).get(QUESTIONS)).status).toBe(401);
        expect((await player.get(QUESTIONS)).status).toBe(403);
        expect((await player.get(COUNTRIES)).status).toBe(403);
    });
});

describe('listing questions', () => {
    it('finds questions by their text and shows each with its country, answers and state', async () => {
        const res = await admin.get(QUESTIONS).query({ search: 'admin test question' });
        expect(res.status).toBe(200);
        expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
        expect(res.body.data[0]).toEqual({
            questionId: seeded[0].questionId,
            country: COUNTRY,
            imageUrl: 'https://example.com/admin-q-test-0.jpg',
            question: 'Admin test question 0',
            hint: 'Admin test hint 0',
            answer1: 'A0 one',
            answer2: 'A0 two',
            answer3: 'A0 three',
            correctAnswer: 1,
            hiddenAt: null,
            played: false,
        });
        // Cloudinary's name for the photo stays on the server
        expect(JSON.stringify(res.body)).not.toMatch(/cloudinary/i);
    });

    it('finds questions by their country, a page at a time', async () => {
        const res = await admin.get(QUESTIONS).query({ search: 'testland', limit: 2, page: 2 });
        expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
        expect(res.body.data.map((q) => q.questionId)).toEqual([seeded[2].questionId]);
    });

    it('takes % in the search literally', async () => {
        const res = await admin.get(QUESTIONS).query({ search: 'admin test question%' });
        expect(res.body.pagination.total).toBe(0);
    });

    it('refuses a page below 1', async () => {
        const res = await admin.get(QUESTIONS).query({ page: 0 });
        expect(res.status).toBe(400);
        expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'query.page' })]);
    });
});

describe('one question', () => {
    it('shows the question an admin edits', async () => {
        const res = await admin.get(`${QUESTIONS}/${seeded[1].questionId}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ questionId: seeded[1].questionId, correctAnswer: 2, played: false });
    });

    it('answers 404 for a question that doesn\'t exist, and 400 for an id that isn\'t one', async () => {
        expect((await admin.get(`${QUESTIONS}/2147483647`)).status).toBe(404);
        expect((await admin.get(`${QUESTIONS}/abc`)).status).toBe(400);
    });

    it('previews a question as a player would see it, with the right button marked', async () => {
        const question = seeded[2];
        const res = await admin.get(`${QUESTIONS}/${question.questionId}/preview`);
        expect(res.status).toBe(200);
        const { answers, correctChoice, ...rest } = res.body.data;
        expect(rest).toEqual({ imageUrl: question.imageUrl, text: question.question, hint: question.hint, hidden: false });
        expect([...answers].sort()).toEqual([question.answer1, question.answer2, question.answer3].sort());
        expect(answers[correctChoice - 1]).toBe(question[`answer${question.correctAnswer}`]);
    });
});

describe('countries', () => {
    it('lists every country by name, for the form\'s suggestions', async () => {
        const res = await admin.get(COUNTRIES);
        expect(res.status).toBe(200);
        expect(res.body.data).toContainEqual({ countryId: seeded[0].countryId, name: COUNTRY });
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- tests/adminQuestions.test.js`
Expected: FAIL, every route answers 404.

- [ ] **Step 3: Write `questions.js` with the read steps**

`src/lib/questions.js` (new):

```js
import { asc, count, eq, ilike, or, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { countries, questions, roundQuestions } from '../db/schema/index.js';
import { AppError } from './errors.js';
import { containsPattern, pagination } from './lists.js';
import { shuffleAnswers } from './picking.js';

const NOT_FOUND = 'Question not found';

// What an admin sees of a question: everything but Cloudinary's name for the photo
const adminFields = {
    questionId: questions.questionId,
    country: countries.name,
    imageUrl: questions.imageUrl,
    question: questions.question,
    hint: questions.hint,
    answer1: questions.answer1,
    answer2: questions.answer2,
    answer3: questions.answer3,
    correctAnswer: questions.correctAnswer,
    hiddenAt: questions.hiddenAt,
    // Whether any round has used it, which decides between deleting and hiding
    played: sql`exists (select 1 from ${roundQuestions} where ${roundQuestions.questionId} = ${questions.questionId})`.mapWith(Boolean),
};

const fromQuestions = (fields) => db.select(fields).from(questions).innerJoin(countries, eq(countries.countryId, questions.countryId));

// A page of questions, by country then id, optionally only those whose text or country contains `search`
export async function listQuestions({ page, limit, search }) {
    const where = search
        ? or(ilike(questions.question, containsPattern(search)), ilike(countries.name, containsPattern(search)))
        : undefined;
    const [items, [{ total }]] = await Promise.all([
        fromQuestions(adminFields)
            .where(where)
            .orderBy(asc(countries.name), asc(questions.questionId))
            .limit(limit)
            .offset((page - 1) * limit),
        fromQuestions({ total: count() }).where(where),
    ]);
    return { data: items, pagination: pagination(page, limit, total) };
}

// One question as an admin sees it. 404 if there is none
export async function getQuestion(questionId) {
    const [question] = await fromQuestions(adminFields).where(eq(questions.questionId, questionId));
    if (!question) throw new AppError(404, NOT_FOUND);
    return question;
}

// A question as a player would see it, with the right button marked. Saves nothing
export async function previewQuestion(questionId) {
    const question = await getQuestion(questionId);
    const order = shuffleAnswers();
    return {
        imageUrl: question.imageUrl,
        text: question.question,
        answers: order.map((n) => question[`answer${n}`]),
        hint: question.hint,
        correctChoice: order.indexOf(question.correctAnswer) + 1,
        hidden: question.hiddenAt !== null,
    };
}

// Every country, by name
export function listCountries() {
    return db.select({ countryId: countries.countryId, name: countries.name }).from(countries).orderBy(asc(countries.name));
}
```

- [ ] **Step 4: Write the two routers and mount them**

`src/routes/adminQuestions.routes.js` (new):

```js
import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listQuerySchema } from '../validation/admin.js';
import { idParamsSchema } from '../validation/common.js';
import { listQuestions, getQuestion, previewQuestion } from '../lib/questions.js';

const adminQuestionsRouter = Router();

// Every route here is for admins only
adminQuestionsRouter.use(requireAuth, requireRole('admin'));

// A page of questions, hidden ones included
adminQuestionsRouter.get('/', validate({ query: listQuerySchema }), async (req, res) => {
    res.json(await listQuestions(req.valid.query));
});

// One question, for the edit form
adminQuestionsRouter.get('/:id', validate({ params: idParamsSchema }), async (req, res) => {
    res.json({ data: await getQuestion(req.valid.params.id) });
});

// The question as a player would see it, with the right answer marked
adminQuestionsRouter.get('/:id/preview', validate({ params: idParamsSchema }), async (req, res) => {
    res.json({ data: await previewQuestion(req.valid.params.id) });
});

export default adminQuestionsRouter;
```

`src/routes/adminCountries.routes.js` (new):

```js
import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { listCountries } from '../lib/questions.js';

const adminCountriesRouter = Router();

adminCountriesRouter.use(requireAuth, requireRole('admin'));

// Every country, for the question form's suggestions
adminCountriesRouter.get('/', async (req, res) => {
    res.json({ data: await listCountries() });
});

export default adminCountriesRouter;
```

`src/app.js`: add the imports after `roundsRouter`'s

```js
import adminQuestionsRouter from './routes/adminQuestions.routes.js';
import adminCountriesRouter from './routes/adminCountries.routes.js';
```

and the mounts after `/api/v1/rounds`

```js
app.use('/api/v1/admin/questions', adminQuestionsRouter);
app.use('/api/v1/admin/countries', adminCountriesRouter);
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- tests/adminQuestions.test.js`, then `npm test` and `npm run lint`
Expected: PASS everywhere; lint clean.

- [ ] **Step 6: Commit (ask Slav first)**

```bash
git add src/lib/questions.js src/routes/adminQuestions.routes.js src/routes/adminCountries.routes.js src/app.js tests/adminQuestions.test.js
git commit -m "feat: let admins list, read and preview questions"
```

**Explain to Slav:** `router.use(requireAuth, requireRole('admin'))` as one guard for the whole
file; `LIMIT` and `OFFSET`, with page 2 of 20 as `OFFSET 20`; why the list and the count run side
by side with `Promise.all`; what the `exists (...)` subquery asks of each row; why `cloudinaryId`
is left out of `adminFields`.

---

### Task 6: Adding and editing questions

**Files:**

- Modify: `backend/src/lib/questions.js`, `backend/src/routes/adminQuestions.routes.js`
- Test: `backend/tests/adminQuestions.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/adminQuestions.test.js`, change the first imports to:

```js
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { eq, like } from 'drizzle-orm';
```

add `import { cloudinary } from '../src/config/cloudinary.js';` after the schema import, and add
after the `COUNTRIES` constant:

```js
// What the add form sends, as text, the way a browser sends a form
const FORM = {
    country: COUNTRY,
    question: 'Admin test: which tower is this?',
    hint: 'Admin test hint',
    answer1: 'Admin tower one',
    answer2: 'Admin tower two',
    answer3: 'Admin tower three',
    correctAnswer: '2',
};
const PHOTO = { filename: 'landmark.jpg', contentType: 'image/jpeg' };
```

and after `newAdmin`:

```js
// Fills a multipart request with the form's fields, `values` replacing some of them
function withForm(req, values = {}) {
    for (const [name, value] of Object.entries({ ...FORM, ...values })) req.field(name, String(value));
    return req;
}

// Cloudinary is never called: each upload "succeeds" with a new name, and deletes do nothing
let upload;
let destroy;
let uploads = 0;
beforeEach(() => {
    upload = vi.spyOn(cloudinary.uploader, 'upload').mockImplementation(async () => {
        uploads += 1;
        return { public_id: `world-quiz/test/questions/${CLOUDINARY_ID}-${uploads}`, version: 1700000000 };
    });
    destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
});
afterEach(() => vi.restoreAllMocks());
```

and at the end of the file:

```js
describe('adding a question', () => {
    it('saves the question with its photo, finding the country whatever the capitals', async () => {
        const res = await withForm(admin.post(QUESTIONS), { country: 'admin TESTLAND' })
            .attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({
            country: COUNTRY,
            question: FORM.question,
            correctAnswer: 2,
            hiddenAt: null,
            played: false,
            imageUrl: expect.stringMatching(new RegExp(`/v1700000000/world-quiz/test/questions/${CLOUDINARY_ID}-\\d+$`)),
        });
        expect(upload).toHaveBeenCalledTimes(1);
        const [row] = await db.select().from(questions).where(eq(questions.questionId, res.body.data.questionId));
        expect(row.cloudinaryId).toMatch(new RegExp(`^world-quiz/test/questions/${CLOUDINARY_ID}-`));
    });

    it('makes a new country when none matches', async () => {
        const res = await withForm(admin.post(QUESTIONS), { country: 'Admin Testonia' })
            .attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.body.data.country).toBe('Admin Testonia');
        expect((await admin.get(COUNTRIES)).body.data.map((c) => c.name)).toContain('Admin Testonia');
    });

    it('needs a photo', async () => {
        const res = await withForm(admin.post(QUESTIONS));
        expect(res.status).toBe(400);
        expect(res.body.error.details).toEqual([{ path: 'body.photo', message: 'Choose a photo of the landmark.' }]);
    });

    it('refuses a file that isn\'t a JPEG, PNG or WebP, and a photo over 5 MB, before uploading', async () => {
        const gif = await withForm(admin.post(QUESTIONS))
            .attach('photo', Buffer.from('gif bytes'), { filename: 'a.gif', contentType: 'image/gif' });
        expect(gif.status).toBe(400);
        expect(gif.body.error.details).toEqual([{ path: 'body.photo', message: 'Choose a JPEG, PNG or WebP photo.' }]);

        const big = await withForm(admin.post(QUESTIONS)).attach('photo', Buffer.alloc(5 * 1024 * 1024 + 1), PHOTO);
        expect(big.status).toBe(400);
        expect(big.body.error.details).toEqual([{ path: 'body.photo', message: 'Choose a photo of 5 MB or less.' }]);
        expect(upload).not.toHaveBeenCalled();
    });

    it('lists every problem with the fields, and uploads nothing', async () => {
        const res = await withForm(admin.post(QUESTIONS), { hint: ' ', correctAnswer: '4' })
            .attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.status).toBe(400);
        expect(res.body.error.details.map((d) => d.path).sort()).toEqual(['body.correctAnswer', 'body.hint']);
        expect(upload).not.toHaveBeenCalled();
    });

    it('shows Cloudinary refusing the file under the photo field', async () => {
        upload.mockRejectedValueOnce({ http_code: 400, message: 'Invalid image file' });
        const res = await withForm(admin.post(QUESTIONS)).attach('photo', Buffer.from('not an image'), PHOTO);
        expect(res.status).toBe(400);
        expect(res.body.error.details[0].path).toBe('body.photo');
    });
});

describe('editing a question', () => {
    it('changes the text and keeps the photo when no new one is sent', async () => {
        const id = seeded[0].questionId;
        const res = await admin.put(`${QUESTIONS}/${id}`)
            .send({ ...FORM, hint: 'An edited hint', correctAnswer: 3 });
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ hint: 'An edited hint', correctAnswer: 3, imageUrl: seeded[0].imageUrl });
        expect(upload).not.toHaveBeenCalled();
        expect(destroy).not.toHaveBeenCalled();
    });

    it('replaces the photo and deletes the old one from Cloudinary', async () => {
        const id = seeded[1].questionId;
        const res = await withForm(admin.put(`${QUESTIONS}/${id}`)).attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.status).toBe(200);
        expect(res.body.data.imageUrl).not.toBe(seeded[1].imageUrl);
        expect(destroy).toHaveBeenCalledWith(CLOUDINARY_ID, { resource_type: 'image', invalidate: true });
    });

    it('answers 404 for a question that doesn\'t exist, uploading nothing', async () => {
        const res = await withForm(admin.put(`${QUESTIONS}/2147483647`)).attach('photo', Buffer.from('jpeg bytes'), PHOTO);
        expect(res.status).toBe(404);
        expect(upload).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- tests/adminQuestions.test.js`
Expected: the new tests FAIL with 404 (no `POST /` or `PUT /:id` yet); the Task 5 tests still pass.

- [ ] **Step 3: Add create and update to `questions.js`**

In `src/lib/questions.js`, add `import { deletePhoto, uploadQuestionPhoto } from './photos.js';`
after the `picking.js` import, and at the end of the file:

```js
// The id of the country with this name, whatever its capitals, made first if there is none
async function countryIdFor(name) {
    const find = () => db
        .select({ countryId: countries.countryId })
        .from(countries)
        .where(sql`lower(${countries.name}) = lower(${name})`);
    const [found] = await find();
    if (found) return found.countryId;
    // If another request made the same country a moment ago, this does nothing and the second look finds it
    await db.insert(countries).values({ name }).onConflictDoNothing();
    const [made] = await find();
    return made.countryId;
}

// Adds a question with its photo. The photo goes up first, because the row needs its address
export async function createQuestion({ country, ...fields }, file) {
    const countryId = await countryIdFor(country);
    const photo = await uploadQuestionPhoto(file);
    try {
        const [{ questionId }] = await db
            .insert(questions)
            .values({ ...fields, countryId, ...photo })
            .returning({ questionId: questions.questionId });
        return getQuestion(questionId);
    } catch (error) {
        // No row points at the new photo, so it would only take up space
        await deletePhoto(photo.cloudinaryId);
        throw error;
    }
}

// Changes a question, and its photo if a new one is sent. The old photo goes only once the row points at the new one
export async function updateQuestion(questionId, { country, ...fields }, file) {
    const [old] = await db
        .select({ cloudinaryId: questions.cloudinaryId })
        .from(questions)
        .where(eq(questions.questionId, questionId));
    if (!old) throw new AppError(404, NOT_FOUND);

    const countryId = await countryIdFor(country);
    const photo = file ? await uploadQuestionPhoto(file) : null;
    try {
        const [saved] = await db
            .update(questions)
            .set({ ...fields, countryId, ...photo })
            .where(eq(questions.questionId, questionId))
            .returning({ questionId: questions.questionId });
        // Deleted by another admin since the first look
        if (!saved) throw new AppError(404, NOT_FOUND);
    } catch (error) {
        if (photo) await deletePhoto(photo.cloudinaryId);
        throw error;
    }
    if (photo) await deletePhoto(old.cloudinaryId);
    return getQuestion(questionId);
}
```

Spreading `null` adds nothing, so a JSON edit leaves `imageUrl` and `cloudinaryId` as they are.

- [ ] **Step 4: Add the two routes**

In `src/routes/adminQuestions.routes.js`, change the imports to:

```js
import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { photoUpload } from '../middleware/upload.js';
import { fieldError } from '../lib/errors.js';
import { listQuerySchema, questionSchema } from '../validation/admin.js';
import { idParamsSchema } from '../validation/common.js';
import { listQuestions, getQuestion, previewQuestion, createQuestion, updateQuestion } from '../lib/questions.js';
```

and add after the `GET /` route:

```js
// Adds a question from the form: its fields and a photo
adminQuestionsRouter.post('/', photoUpload, validate({ body: questionSchema }), async (req, res) => {
    if (!req.file) throw fieldError(400, 'photo', 'Choose a photo of the landmark.');
    res.status(201).json({ data: await createQuestion(req.valid.body, req.file) });
});
```

and after the `GET /:id/preview` route:

```js
// Changes a question. Sent as a form with a photo to replace it, or as JSON to keep it
adminQuestionsRouter.put('/:id', photoUpload, validate({ params: idParamsSchema, body: questionSchema }), async (req, res) => {
    res.json({ data: await updateQuestion(req.valid.params.id, req.valid.body, req.file) });
});
```

`photoUpload` runs after the guard in `router.use`, so nobody who isn't an admin gets a file read.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- tests/adminQuestions.test.js`
Expected: PASS. If every multipart test answers 400 with all seven fields "required", Zod isn't
reading multer's prototype-less `req.body`: in `photoUpload`, set `req.body = { ...req.body }`
before `next(error)` and run again.

Then `npm test` and `npm run lint`. Expected: PASS everywhere; lint clean.

- [ ] **Step 6: Commit (ask Slav first)**

```bash
git add src/lib/questions.js src/routes/adminQuestions.routes.js tests/adminQuestions.test.js
git commit -m "feat: let admins add and edit questions with a photo"
```

**Explain to Slav:** the order photo → row → old photo, walked through with the edit test's data,
and what goes wrong in each other order; why `countryIdFor` looks twice; why the photo is checked
in the route after validation; why the edit route takes both a form and JSON.

---

### Task 7: Deleting, hiding and unhiding questions

**Files:**

- Modify: `backend/src/lib/questions.js`, `backend/src/routes/adminQuestions.routes.js`
- Test: `backend/tests/adminQuestions.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/adminQuestions.test.js`, add `rounds, roundQuestions` to the schema import, so it reads
`import { users, countries, questions, rounds, roundQuestions } from '../src/db/schema/index.js';`.
In `beforeAll`, keep the player's id: replace the line
`await player.post('/api/v1/auth/sign-up').send(newAccount());` with

```js
    playerId = (await player.post('/api/v1/auth/sign-up').send(newAccount())).body.data.userId;
```

and add `let playerId;` under `let player;`. Add after `withForm`:

```js
// A question written straight into the table, as one an admin could have added
async function addQuestion(values = {}) {
    const [question] = await db.insert(questions).values({
        countryId: seeded[0].countryId,
        imageUrl: 'https://example.com/admin-q-test-extra.jpg',
        cloudinaryId: `${CLOUDINARY_ID}-extra`,
        question: 'Admin test extra question',
        hint: 'Admin test extra hint',
        answer1: 'One',
        answer2: 'Two',
        answer3: 'Three',
        correctAnswer: 1,
        ...values,
    }).returning();
    return question;
}

// Puts a question in one of the player's rounds, so the database counts it as played
async function playQuestion(questionId) {
    const [round] = await db.insert(rounds)
        .values({ userId: playerId, status: 'abandoned', finishedAt: new Date() })
        .returning();
    await db.insert(roundQuestions).values({ roundId: round.roundId, position: 1, questionId, answerOrder: [1, 2, 3] });
}
```

and at the end of the file:

```js
describe('deleting a question', () => {
    it('deletes a question no round has used, and its photo', async () => {
        const question = await addQuestion();
        const res = await admin.delete(`${QUESTIONS}/${question.questionId}`);
        expect(res.status).toBe(204);
        expect(await db.select().from(questions).where(eq(questions.questionId, question.questionId))).toHaveLength(0);
        expect(destroy).toHaveBeenCalledWith(`${CLOUDINARY_ID}-extra`, { resource_type: 'image', invalidate: true });
    });

    it('refuses to delete a played question, keeps its photo, and lists it as played', async () => {
        const question = await addQuestion();
        await playQuestion(question.questionId);
        const res = await admin.delete(`${QUESTIONS}/${question.questionId}`);
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe('This question has been played, so it can only be hidden');
        expect(destroy).not.toHaveBeenCalled();
        expect((await admin.get(`${QUESTIONS}/${question.questionId}`)).body.data.played).toBe(true);
    });

    it('answers 404 for a question that doesn\'t exist', async () => {
        expect((await admin.delete(`${QUESTIONS}/2147483647`)).status).toBe(404);
    });
});

describe('hiding a question', () => {
    it('hides a question, keeps the first time on a second hide, and brings it back', async () => {
        const question = await addQuestion();
        const url = `${QUESTIONS}/${question.questionId}`;

        const hidden = await admin.post(`${url}/hide`);
        expect(hidden.status).toBe(200);
        expect(hidden.body.data.hiddenAt).toEqual(expect.any(String));
        expect((await admin.post(`${url}/hide`)).body.data.hiddenAt).toBe(hidden.body.data.hiddenAt);
        expect((await admin.get(`${url}/preview`)).body.data.hidden).toBe(true);

        const shown = await admin.post(`${url}/unhide`);
        expect(shown.status).toBe(200);
        expect(shown.body.data.hiddenAt).toBeNull();
    });

    it('answers 404 for a question that doesn\'t exist', async () => {
        expect((await admin.post(`${QUESTIONS}/2147483647/hide`)).status).toBe(404);
        expect((await admin.post(`${QUESTIONS}/2147483647/unhide`)).status).toBe(404);
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- tests/adminQuestions.test.js`
Expected: the new tests FAIL with 404; the earlier ones pass.

- [ ] **Step 3: Add delete and hide to `questions.js`**

In `src/lib/questions.js`, change `import { AppError } from './errors.js';` to
`import { AppError, isRestrictViolation } from './errors.js';` and add at the end:

```js
// Deletes a question no round has used, and its photo. A played one is a 409: it can only be hidden
export async function deleteQuestion(questionId) {
    let deleted;
    try {
        [deleted] = await db
            .delete(questions)
            .where(eq(questions.questionId, questionId))
            .returning({ cloudinaryId: questions.cloudinaryId });
    } catch (error) {
        // The database decides, so a round that picked it a moment ago still counts
        if (isRestrictViolation(error)) throw new AppError(409, 'This question has been played, so it can only be hidden');
        throw error;
    }
    if (!deleted) throw new AppError(404, NOT_FOUND);
    await deletePhoto(deleted.cloudinaryId);
}

// Hides a question from new rounds, or brings it back. Rounds that already hold it keep it
export async function setHidden(questionId, hidden) {
    const [saved] = await db
        .update(questions)
        // coalesce keeps the first time it was hidden when it's hidden again
        .set({ hiddenAt: hidden ? sql`coalesce(${questions.hiddenAt}, now())` : null })
        .where(eq(questions.questionId, questionId))
        .returning({ questionId: questions.questionId });
    if (!saved) throw new AppError(404, NOT_FOUND);
    return getQuestion(questionId);
}
```

- [ ] **Step 4: Add the three routes**

In `src/routes/adminQuestions.routes.js`, add `deleteQuestion, setHidden` to the `questions.js`
import, and at the end, before `export default`:

```js
// Deletes a question no round has used. A played one answers 409
adminQuestionsRouter.delete('/:id', validate({ params: idParamsSchema }), async (req, res) => {
    await deleteQuestion(req.valid.params.id);
    res.status(204).end();
});

// Keeps a question out of new rounds
adminQuestionsRouter.post('/:id/hide', validate({ params: idParamsSchema }), async (req, res) => {
    res.json({ data: await setHidden(req.valid.params.id, true) });
});

// Lets new rounds pick a hidden question again
adminQuestionsRouter.post('/:id/unhide', validate({ params: idParamsSchema }), async (req, res) => {
    res.json({ data: await setHidden(req.valid.params.id, false) });
});
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test` and `npm run lint`
Expected: PASS everywhere; lint clean.

- [ ] **Step 6: Commit (ask Slav first)**

```bash
git add src/lib/questions.js src/routes/adminQuestions.routes.js tests/adminQuestions.test.js
git commit -m "feat: let admins delete unplayed questions and hide played ones"
```

**Explain to Slav:** why the delete is tried and its refusal read, instead of checking "played"
first (the race between the check and the delete); `23001` against `23503`; why hide and unhide
are `POST` sub-paths and not a `PUT` (`api.md`: actions that aren't CRUD); what `coalesce` does.

---

### Task 8: Users as an admin: list and delete

**Files:**

- Create: `backend/src/lib/users.js`, `backend/src/routes/adminUsers.routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/adminUsers.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/adminUsers.test.js` (new):

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq, like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, scores, rounds } from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/passwords.js';

const PREFIX = 'admin-u-test-';
const PASSWORD = 'correct-horse-battery';
const USERS = '/api/v1/admin/users';

let admin;
let adminId;

let count = 0;
function newAccount() {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `AdminU${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD };
}

async function newPlayer() {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/sign-up').send(newAccount());
    return { agent, userId: res.body.data.userId, email: res.body.data.email };
}

beforeAll(async () => {
    const account = newAccount();
    [{ userId: adminId }] = await db.insert(users).values({
        name: account.name,
        email: account.email,
        passwordHash: await hashPassword(PASSWORD),
        role: 'admin',
    }).returning();
    admin = request.agent(app);
    await admin.post('/api/v1/auth/login').send({ email: account.email, password: PASSWORD });
});

afterAll(async () => {
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
});

describe('who may use the admin user routes', () => {
    it('needs a login, and turns players away', async () => {
        expect((await request(app).get(USERS)).status).toBe(401);
        expect((await (await newPlayer()).agent.get(USERS)).status).toBe(403);
    });
});

describe('listing users', () => {
    it('shows each account without its password, with tokens and level for players', async () => {
        const player = await newPlayer();
        await db.update(scores).set({ starTokens: 250 }).where(eq(scores.userId, player.userId));

        const res = await admin.get(USERS).query({ search: PREFIX });
        expect(res.status).toBe(200);
        const found = res.body.data.find((u) => u.userId === player.userId);
        expect(found).toEqual({
            userId: player.userId,
            name: expect.stringMatching(/^AdminU/),
            email: player.email,
            role: 'user',
            createdAt: expect.any(String),
            starTokens: 250,
            level: 3,
        });
        // Admins have no score row
        expect(res.body.data.find((u) => u.userId === adminId)).toMatchObject({ role: 'admin', starTokens: null, level: null });
        expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('lists the newest first, a page at a time', async () => {
        const older = await newPlayer();
        const newer = await newPlayer();
        const res = await admin.get(USERS).query({ search: PREFIX, limit: 2 });
        expect(res.body.data.map((u) => u.userId)).toEqual([newer.userId, older.userId]);
        expect(res.body.pagination).toMatchObject({ page: 1, limit: 2 });
        expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    });
});

describe('deleting a user', () => {
    it('deletes a player with their score, rounds and sessions', async () => {
        const player = await newPlayer();
        await db.insert(rounds).values({ userId: player.userId, status: 'abandoned', finishedAt: new Date() });

        const res = await admin.delete(`${USERS}/${player.userId}`);
        expect(res.status).toBe(204);
        expect(await db.select().from(users).where(eq(users.userId, player.userId))).toHaveLength(0);
        expect(await db.select().from(scores).where(eq(scores.userId, player.userId))).toHaveLength(0);
        expect(await db.select().from(rounds).where(eq(rounds.userId, player.userId))).toHaveLength(0);
        // Their browser's session went with them
        expect((await player.agent.get('/api/v1/auth/me')).status).toBe(401);
    });

    it("refuses to delete an admin, the admin's own account included", async () => {
        const res = await admin.delete(`${USERS}/${adminId}`);
        expect(res.status).toBe(403);
        expect(res.body.error.message).toBe("Admin accounts can't be deleted here");
        expect(await db.select().from(users).where(eq(users.userId, adminId))).toHaveLength(1);
    });

    it('answers 404 for a user that doesn\'t exist', async () => {
        expect((await admin.delete(`${USERS}/2147483647`)).status).toBe(404);
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- tests/adminUsers.test.js`
Expected: FAIL, the routes answer 404.

- [ ] **Step 3: Write `users.js`**

`src/lib/users.js` (new):

```js
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';

import { db } from '../db/index.js';
import { users, scores } from '../db/schema/index.js';
import { publicUser } from './accounts.js';
import { AppError } from './errors.js';
import { containsPattern, pagination } from './lists.js';
import { levelFor } from './scoring.js';

// A page of accounts, newest first, optionally only those whose name or email contains `search`.
// Admins have no score row, so their tokens and level are null
export async function listUsers({ page, limit, search }) {
    const where = search
        ? or(ilike(users.name, containsPattern(search)), ilike(users.email, containsPattern(search)))
        : undefined;
    const [rows, [{ total }]] = await Promise.all([
        db.select({ user: users, starTokens: scores.starTokens })
            .from(users)
            .leftJoin(scores, eq(scores.userId, users.userId))
            .where(where)
            .orderBy(desc(users.createdAt), desc(users.userId))
            .limit(limit)
            .offset((page - 1) * limit),
        db.select({ total: count() }).from(users).where(where),
    ]);
    return {
        data: rows.map(({ user, starTokens }) => ({
            ...publicUser(user),
            starTokens,
            level: starTokens === null ? null : levelFor(starTokens),
        })),
        pagination: pagination(page, limit, total),
    };
}

// Deletes a player; their score, sessions and rounds go with them. Admin accounts are a 403
export async function deleteUser(userId) {
    // The role is part of the delete itself, so nothing can make the account an admin in between
    const [deleted] = await db
        .delete(users)
        .where(and(eq(users.userId, userId), eq(users.role, 'user')))
        .returning({ userId: users.userId });
    if (deleted) return;

    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.userId, userId));
    if (!user) throw new AppError(404, 'User not found');
    throw new AppError(403, "Admin accounts can't be deleted here");
}
```

- [ ] **Step 4: Write the router and mount it**

`src/routes/adminUsers.routes.js` (new):

```js
import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listQuerySchema } from '../validation/admin.js';
import { idParamsSchema } from '../validation/common.js';
import { listUsers, deleteUser } from '../lib/users.js';

const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth, requireRole('admin'));

// A page of accounts with their tokens and level
adminUsersRouter.get('/', validate({ query: listQuerySchema }), async (req, res) => {
    res.json(await listUsers(req.valid.query));
});

// Deletes a player and everything that is theirs
adminUsersRouter.delete('/:id', validate({ params: idParamsSchema }), async (req, res) => {
    await deleteUser(req.valid.params.id);
    res.status(204).end();
});

export default adminUsersRouter;
```

`src/app.js`: add `import adminUsersRouter from './routes/adminUsers.routes.js';` after the
countries router import, and `app.use('/api/v1/admin/users', adminUsersRouter);` after its mount.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test` and `npm run lint`
Expected: PASS everywhere; lint clean.

- [ ] **Step 6: Commit (ask Slav first)**

```bash
git add src/lib/users.js src/routes/adminUsers.routes.js src/app.js tests/adminUsers.test.js
git commit -m "feat: let admins list and delete players"
```

**Explain to Slav:** `leftJoin` against `innerJoin`, with an admin as the row that would vanish;
why the role check sits inside the `DELETE`'s `WHERE`; what the three cascades do when one player
is deleted, walked through table by table.

---

### Task 9: Live check on `dev`

**Files:** none in the repo. One script in the session's scratchpad, deleted afterwards.

- [ ] **Step 1: Start the API on `dev` with Arcjet on**

Run from `backend/`: `npm run dev` (in the background). Expected: it listens on port 5600.

- [ ] **Step 2: Run the check script**

The script reads `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `backend/.env` (as in 2a and
2b, so the password never shows in the chat), sends a browser user agent, and:

1. Logs in as the admin
2. `GET /admin/questions?limit=5`: expects 200 and `total` 46
3. `GET /admin/countries`: expects 16 countries
4. `POST /admin/questions` with a real JPEG from `src/Images/` and a country `Live Checkland`:
   expects 201 and an `imageUrl` on `res.cloudinary.com` under `world-quiz/development/questions/`
5. Fetches that `imageUrl`: expects 200 and an image content type
6. `GET /admin/questions/:id/preview`: expects the right button to point at the right answer
7. `POST /:id/hide`, then `/unhide`: expects `hiddenAt` set, then `null`
8. `PUT /:id` as JSON with a new hint: expects 200 and the same `imageUrl`
9. `DELETE /:id`: expects 204; fetching the old `imageUrl` with a cache-busting query then answers
   404 (Cloudinary may take a minute; retry once)
10. `GET /admin/users`: expects the admin, with `starTokens: null`
11. Deletes `Live Checkland` from `countries` through Drizzle, since no route removes a country

Expected: every step as described. Any other result stops the task; it is diagnosed, not retried.

- [ ] **Step 3: Stop the server and check what's left**

Stop the server; confirm port 5600 is free. Check `dev` still has 46 questions and 16 countries and
the Cloudinary folder has no photo left from the check. Delete the script.

---

### Task 10: Rules, spec and the learning note

**Files:**

- Modify: `.claude/rules/api.md`, `.claude/rules/backend.md`, `.claude/rules/testing.md`,
  `docs/superpowers/specs/2026-11-17-core-game-design.md`
- Create: `docs/learning/04-admin.md`

- [ ] **Step 1: `api.md`**

Add three rows to the mount table:

```markdown
| `/api/v1/admin/questions` | `routes/adminQuestions.routes.js`, admins only: `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `GET /:id/preview`, `POST /:id/hide`, `POST /:id/unhide` |
| `/api/v1/admin/countries` | `routes/adminCountries.routes.js`, admins only: `GET /` |
| `/api/v1/admin/users` | `routes/adminUsers.routes.js`, admins only: `GET /`, `DELETE /:id` |
```

and under "Responses and errors":

```markdown
- **Lists** take `?page=` (from 1), `?limit=` (1 to 100, default 20) and `?search=`, checked by
  `listQuerySchema`; `%` and `_` in a search are literal (`containsPattern`)
- **Photos:** the question form is `multipart/form-data` with one `photo` file (JPEG, PNG or WebP,
  5 MB at most), read by `photoUpload` after the admin guard. A bad file is a 400 under
  `body.photo`. An edit sent as JSON keeps the photo
- **Questions** are deleted only if no round has used them (409 otherwise, from `23001`); a played
  one is hidden (`hidden_at`), and new rounds skip it. Admins can delete players, not admins (403)
```

- [ ] **Step 2: `backend.md`**

In the layout block: add `upload (photoUpload)` to `middleware/`; add `lists.js`, `photos.js`,
`questions.js` and `users.js` to `lib/`; add `isRestrictViolation` beside `isUniqueViolation`; and
add `common.js` and `admin.js` beside the validation line if one exists. In "Stack constraints",
multer is now installed. In "Cloudinary", add:

```markdown
`lib/photos.js` is the only file that calls Cloudinary from the app. Upload first, then write the
row; delete the new photo if the row fails, and an old one only once the row points at its
replacement. A failed delete is logged, not thrown.
```

- [ ] **Step 3: `testing.md`**

Replace "Outside services (Cloudinary) are never called; tests replace them with `vi.mock`" with:

```markdown
Outside services are never called. Cloudinary is replaced with
`vi.spyOn(cloudinary.uploader, 'upload')` and `'destroy'`, restored in `afterEach`, so
`photos.js` and the routes still run
```

- [ ] **Step 4: The spec's phase table**

In `2026-11-17-core-game-design.md`, change the 2c row to
`| 2c | Admin: questions with photo upload, hiding, preview; listing and deleting players | 3–5 |`,
delete the phase 8 row, renumber 9 to 13 as 8 to 12, and add below the table:
`Admin image upload moved into 2c on 2026-11-23 (plan: 2026-11-23-phase-2c-admin.md).` Update the
"Ideas kept for later phases" phase numbers to match.

- [ ] **Step 5: The learning note**

`docs/learning/04-admin.md`, in the shape of `03-core-game.md`: one section per task (hiding and
the migration; skipping hidden questions; the small pieces; photos; reading; adding and editing;
deleting and hiding; users), one request traced end to end (adding a question: browser form →
Arcjet → `requireAuth` → `requireRole` → multer → Zod → country → Cloudinary → row → response), and
six check-yourself questions.

- [ ] **Step 6: Check and commit (ask Slav first)**

Run: `npm test` and `npm run lint` from `backend/`, and `markdownlint-cli2` on every changed
markdown file. Expected: all pass.

```bash
git add .claude/rules/ docs/
git commit -m "docs: add the phase 2c rules and learning note"
```

---

## Done when

- Every test passes (about 140), `npm run lint` is clean, markdown lint is clean
- Migration `0003` is applied to `dev` and `test`
- The live check passed on `dev` with Arcjet on and left nothing behind
- An admin can do every action in the Goal through the API; a player gets 403 on all of it
- `docs/learning/04-admin.md` is written; the spec's phase table shows image upload inside 2c
- Every commit was made on Slav's yes
