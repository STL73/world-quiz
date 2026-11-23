# Phase 2c: the admin

Phase 2c gives admins their tools through the API. An admin can list and search questions, add one
with a photo, edit it, see it as a player would, hide it, bring it back, and delete it if no round
has used it. An admin can also list every account with its tokens and level, and delete a player.
Players get 403 on all of it. The React pages that use this come in phase 4. This note has one
section per task, in the order they were built, then one request traced end to end.

## Hiding questions, and countries whatever the capitals

### `src/db/schema/quiz.js` and `drizzle/0003_hide_questions.sql`

Two changes, applied to both Neon branches:

```sql
ALTER TABLE "countries" DROP CONSTRAINT "countries_name_unique";
ALTER TABLE "questions" ADD COLUMN "hidden_at" timestamp with time zone;
CREATE UNIQUE INDEX "countries_name_lower_unique" ON "countries" USING btree (lower("name"));
```

**`hidden_at`.** A question that has been in a round can't be deleted: `round_questions` points at
it with `ON DELETE RESTRICT`, so old results keep their questions. The admin needs another way to
take it out of the game, and that is hiding. The column is empty (`NULL`) for a visible question
and holds a date for a hidden one. A date rather than true/false costs nothing extra and also says
*since when*.

**Countries whatever the capitals.** The old rule compared names exactly, so "France" and
"france" were different and both could exist. The new index is built on `lower(name)`: every name
is compared in lowercase, so the second spelling is refused with `23505`. The old rule was dropped
rather than kept: anything differing only in capitals also differs exactly, so the new rule
already refuses everything the old one did. Player names use the same trick since 2a.

`tests/schema.test.js` gained two tests: a new question is visible, and an upper-case copy of a
country's name is refused.

## New rounds skip hidden questions

### `src/lib/rounds.js`: `startRound`

One line changed. The round used to pick from every question; now it picks from those whose
`hidden_at` is empty:

```js
const all = await db.select({ questionId: questions.questionId }).from(questions).where(isNull(questions.hiddenAt));
```

Nothing else had to change: `pickQuestions` only sees the ids it's given. If every question were
hidden, the existing check answers 409 "There are no questions to play yet".

A question hidden *during* a round stays in that round. Its position was fixed when the round
started, and `currentRound` and `answerQuestion` read the round's own rows. Removing it would leave
a gap in positions 1 to 10.

The test in `rounds.test.js` hides 3 of its 12 questions, starts a round (9 questions, none of the
3), and unhides them in `finally`, which runs even when an `expect` fails, so the tests after it
still find all 12.

## Small shared pieces

### `src/lib/scoring.js`: `levelFor`

```js
export const levelFor = (starTokens) => Math.floor(starTokens / TOKENS_PER_LEVEL) + 1;
```

0 to 99 tokens is level 1, 100 to 199 level 2; 250 is level 3; the 650 a perfect player can earn
is level 7. The level is always worked out, never stored, so it can't disagree with the tokens.

### `src/lib/errors.js`: `isRestrictViolation`

True when Postgres refused a delete with code `23001`: "another table still points at this row,
and the rule says RESTRICT". Not to be confused with `23503`, which is the opposite direction:
"you pointed at a row that doesn't exist".

### `src/lib/lists.js`: `containsPattern` and `pagination`

`ILIKE` compares text ignoring capitals, and in its patterns `%` means "anything here" and `_`
means "any one character". `containsPattern('paris')` gives `%paris%`: paris anywhere.

The trap: an admin who searches `100%` doesn't mean "100 followed by anything". So
`containsPattern` puts a backslash, the **escape character**, before every `%`, `_` and backslash
the admin typed. A backslash tells Postgres "the next character is just itself". `100%` becomes
`%100\%%`. Like putting a word in quotation marks so it is read as the word, not an instruction.

`pagination(page, limit, total)` builds `{ page, limit, total, totalPages }`. 46 questions at 20 a
page: 46 / 20 = 2.3, rounded up, 3 pages.

### `src/validation/common.js`, `rounds.js` and `admin.js`

`idParamsSchema` is the id rule `rounds.js` already had, moved to a shared file. `rounds.js` now
re-exports it under its old name, so the two can never drift apart:

```js
export { idParamsSchema as roundParamsSchema } from './common.js';
```

`listQuerySchema` reads `?page=3&limit=50&search=paris`. Everything in an address is text, so
`z.coerce.number()` turns `"3"` into 3. Missing values take defaults (page 1, 20 a page).

`questionSchema` checks the add and edit form. A `text()` helper builds each text rule once:
required, trimmed, and no longer than its column. `correctAnswer` uses `z.coerce` because a form
sends `"2"`. The rule that the three answers differ is a `.refine` on the whole object, because it
compares fields with each other: the answers are lowercased into a `Set`, which keeps one of each,
so fewer than 3 means two matched. The error appears under `body.answers`.

## Photos

### `multipart/form-data`

JSON is text only; it can't carry a photo. A form with a file is sent as `multipart/form-data`:
the request is cut into parts, one per field and one holding the file's raw bytes, each with its
own small header. `express.json()` can't read that. **multer** can.

### `src/middleware/upload.js`: `photoUpload`

The multer settings:

| Setting | Value | Why |
| --- | --- | --- |
| `storage` | `memoryStorage()` | The photo goes straight on to Cloudinary, so it never needs a file on the server |
| `limits.fileSize` | 5 MB | Multer stops reading the moment a file is bigger. Without a limit, memory storage could be filled |
| `limits.files` | 1 | One photo per question |
| `fileFilter` | JPEG, PNG or WebP | Refused before the bytes are read |
| `.single('photo')` | | At most one file, in the field named `photo` |

The type comes from the browser, which takes it from the file's name, so a text file renamed
`.jpg` gets past `fileFilter`. Cloudinary reads the actual bytes and refuses it (below): two
guards, each catching what the other can't.

Multer reports its own errors with a `code` but no HTTP status, which our error handler would turn
into a 500. `photoUpload` wraps multer and turns them into 400s under `body.photo`: "Choose a photo
of 5 MB or less" or "Send one photo, in the photo field". A request sent as JSON isn't multipart,
so multer leaves it alone.

### `src/lib/photos.js`

The only file in the app that talks to Cloudinary.

`uploadQuestionPhoto(file)` turns the bytes into a **data URI**, the whole file written as text
(`data:image/jpeg;base64,/9j/4AAQ...`). **Base64** writes any bytes using only letters, digits,
`+` and `/`. Cloudinary accepts a data URI as an upload, so the photo goes from memory without a
temporary file. The options: `folder` (passed apart from the name, the dynamic-folders lesson of
phase 1), `resource_type: 'image'`, and `transformation: [{ width: 1600, crop: 'limit' }]`, which
shrinks anything wider and never enlarges. It returns `{ imageUrl, cloudinaryId }`, the two
columns the row needs. Cloudinary's `http_code: 400` ("not an image") becomes a 400 under
`body.photo`; any other failure is thrown as it is and becomes a 500.

`deletePhoto(cloudinaryId)` destroys a photo with `invalidate: true`, which clears Cloudinary's
cache so the old address stops working within minutes. It **logs** a failure instead of throwing
it, because it always runs after the database has changed: throwing would tell the admin "it
failed" when it worked, and a leftover photo only costs storage. An upload is different: it runs
before the database write, so its failure must stop everything.

### `tests/photos.test.js` and `vi.spyOn`

`vi.spyOn(cloudinary.uploader, 'upload')` replaces one function on the object `photos.js` really
uses, and `mockResolvedValue(...)` says what the fake answers. `vi.mock` would replace a whole
module; the spy is narrower, so the rest of the SDK, `questionImageUrl` included, still runs for
real. `afterEach(() => vi.restoreAllMocks())` puts the real functions back after each test.

Before writing `photos.js`, a stub proved the spy works on this SDK: the tests failed on their own
assertions, not with `Cannot redefine property`.

## Reading questions

### `src/lib/questions.js`: `adminFields`, `listQuestions`, `getQuestion`, `previewQuestion`

`adminFields` is the list of columns an admin sees, shared by the list and the detail so they
can't drift apart. Three things to notice:

- `country: countries.name` comes from the joined table, so the admin sees "France", not an id
- `cloudinaryId` is left out: the browser never needs Cloudinary's internal name
- `played` asks each row `exists (select 1 from round_questions where question_id = this one)`.
  Postgres stops at the first match, so it's cheap. The frontend uses it to show Delete or Hide

`listQuestions` builds one `where` (question text **or** country name contains the search), then
sends two queries at once with `Promise.all`: the page of rows and the total count, both with the
same `where`. The wait is the slower of the two, not both added up. `LIMIT` and `OFFSET` pick the
page: page 2 at 20 a page is `OFFSET 20`, skip 20 and take 20. The order (country name, then id)
is fixed, so a page never shuffles between requests.

`previewQuestion` shuffles the answers with the same `shuffleAnswers()` a round uses and marks the
right button. With order `[3, 1, 2]` and right answer 1, answer 1 sits on button 2, so
`correctChoice` is 2. It saves nothing.

### `src/routes/adminQuestions.routes.js` and `adminCountries.routes.js`

```js
adminQuestionsRouter.use(requireAuth, requireRole('admin'));
```

One line guards every route in the file, so a route added later can't forget it. `requireAuth`
comes first (no session: 401, and `req.user` is never set), `requireRole('admin')` second (a
player: 403). The countries list has its own router because `api.md` asks for one per resource,
and because `/questions/countries` would have been read as an id by `/:id` and refused with 400.

## Adding and editing questions

### `countryIdFor(name)`

Looks for a country whose lowercase name matches; if there is none, inserts it with
`onConflictDoNothing()`, then looks again. If another admin made the same country a split second
earlier, the index from Task 1 refuses the insert, "do nothing" means no error, and the second
look finds it.

### `createQuestion` and the photo order

Country, then **photo up**, then **row in**. If the insert fails, the new photo is deleted, since
nothing points at it. The `catch` wraps only the insert: reading the saved question back happens
after it, so nothing that goes wrong on that read can delete a photo a saved row uses.

### `updateQuestion`

1. Look up the old row's `cloudinaryId`; none means 404, before anything is uploaded
2. Country, then a photo **only if one was sent**
3. Update the row. With no new photo, `...photo` spreads `null`, which adds nothing, so the old
   photo stays
4. If the row vanished in between, 404, and the new photo is deleted
5. Only now, with the row pointing at the new photo, the old one is deleted

Walk-through: a question has photo `admin-q-test`; the new upload is `admin-q-test-7`. The row
changes to `-7`, *then* `admin-q-test` is destroyed. The other order could leave a question
pointing at a photo that no longer exists: a broken image in the quiz. This order's worst case is a
leftover photo nobody sees.

### The routes

`POST /` runs `photoUpload` → `validate` → handler. Multer must come first: until it reads the
form, `req.body` is empty. Bad fields stop at Zod, before anything reaches Cloudinary. No file is a
400 under `body.photo`; that check is in the route, after validation, so a form with bad fields
and no photo shows the field errors first.

`PUT /:id` takes a multipart form (the photo is replaced) or plain JSON (the photo is kept).
`z.coerce` reads `correctAnswer` as `"3"` from a form or `3` from JSON alike.

## Deleting and hiding

### `deleteQuestion`

It doesn't check "has this been played?" first. A check then a delete leaves a gap in which a
player could start a round that picks the question. Instead it tries the delete, and Postgres
checks the rule as part of it:

| The database | The admin gets | The photo |
| --- | --- | --- |
| deleted the row | 204 | deleted, using the `cloudinaryId` `returning` handed back |
| refused, `23001` | 409 "This question has been played, so it can only be hidden" | kept |
| found no row | 404 | nothing to do |

### `setHidden`

One `UPDATE` for both actions. Hiding sets `hidden_at = coalesce(hidden_at, now())`. `coalesce`
returns its first non-empty argument, so the first hide writes the time and a second hide keeps
it: a sticky note that says "only write the date if the box is empty". Unhiding sets it to `null`.

Hide and unhide are `POST /:id/hide` and `POST /:id/unhide`, not a `PUT`: `api.md` gives actions
that aren't plain create, read, update or delete a sub-path of their own.

## Users

### `src/lib/users.js`: `listUsers`

The important choice is `leftJoin(scores, ...)`. An **inner join** keeps only users with a matching
score row. Admins have none (the seed script never makes one), so with an inner join the admin
would vanish from the list. A **left join** keeps every user and fills the score columns with
`null` where nothing matches. The level is worked out only when there are tokens; an admin's level
is `null`, not a misleading level 1.

`...publicUser(user)` reuses 2a's function, so the password hash can't leak. The order is newest
first, with `user_id` as the tie-breaker for two accounts made in the same millisecond.

### `deleteUser`

```sql
DELETE FROM users WHERE user_id = $1 AND role = 'user' RETURNING user_id
```

The role is checked inside the delete, so nothing can change between "is this a player?" and
"delete it". The logged-in admin's own row has `role = 'admin'`, so an admin can't delete
themselves. If nothing was deleted, one more read says why: no such user (404) or an admin (403).

One deleted player takes, through `ON DELETE CASCADE`: their score, their sessions (so their
browser is logged out at once; the test checks `/auth/me` answers 401), their rounds, and the
rounds' questions. The questions themselves stay.

## The live check

The API ran on `dev` with Arcjet on. A script logged in as the admin and added a question with the
real Sydney Opera House photo from the PHP version. Cloudinary stored it under
`world-quiz/development/questions/`, and its address loaded as `image/jpeg`. The preview marked
the right button, hide and unhide worked, and a JSON edit kept the photo. The delete answered 204,
the photo's address then answered 404, and Cloudinary's own API confirmed the photo was gone.
Afterwards `dev` still had 46 questions, 16 countries and the 46 imported photos, and nothing else.

## How the files connect

```text
routes/adminQuestions.routes.js ─┬─ middleware/auth.js      (requireAuth, requireRole)
routes/adminCountries.routes.js  ├─ middleware/upload.js    (photoUpload → multer)
routes/adminUsers.routes.js      ├─ middleware/validate.js  (validation/admin.js, common.js)
                                 ├─ lib/questions.js ─┬─ lib/photos.js → config/cloudinary.js
                                 │                    ├─ lib/lists.js
                                 │                    ├─ lib/picking.js (shuffleAnswers)
                                 │                    └─ lib/errors.js (isRestrictViolation)
                                 └─ lib/users.js ─────┬─ lib/accounts.js (publicUser)
                                                      ├─ lib/lists.js
                                                      └─ lib/scoring.js (levelFor)
```

## One request end to end: adding a question

The admin fills in the form in the browser: country "france", the question, a hint, three answers,
"2" as the right one, and `eiffel.jpg` (2 MB). The browser sends `POST /api/v1/admin/questions` as
`multipart/form-data`, with the `sid` cookie.

1. **`helmet()`** adds its security headers to the response-to-be
2. **Arcjet** checks the request isn't a bot or an attack, before any of the body is read
3. **`express.json()`** sees it isn't JSON and does nothing; **`cookieParser()`** reads `sid`
4. **`requireAuth`** finds the session and loads the admin onto `req.user`
5. **`requireRole('admin')`** sees `role: 'admin'` and lets it through. A player would get 403
   here, and multer would never read a byte of their file
6. **`photoUpload`**: multer reads the parts. The text fields go to `req.body`; `eiffel.jpg` is
   `image/jpeg` and under 5 MB, so it goes to `req.file` in memory
7. **`validate`**: Zod trims the text, turns `"2"` into 2, checks the lengths and that the three
   answers differ, and puts the result on `req.valid.body`
8. **The route** checks `req.file` is there and calls `createQuestion`
9. **`countryIdFor('france')`** finds `France` by its lowercase name: no new country
10. **`uploadQuestionPhoto`** sends the data URI to Cloudinary, which stores it resized to
    1600 px wide and answers with its name and version
11. **The insert** writes the row with the country id, the six fields, `imageUrl` and
    `cloudinaryId`
12. **`getQuestion`** reads it back in the admin's shape, and the route answers 201 with it

## Check yourself

<details>
<summary>1. Why can't a played question simply be deleted?</summary>

Its rounds point at it. `round_questions.question_id` is `ON DELETE RESTRICT`, so Postgres refuses
the delete with `23001`, and the old results keep the question they showed. That's why played
questions are hidden instead.

</details>
<details>
<summary>2. Why does `deleteQuestion` try the delete instead of checking `played` first?</summary>

A check and then a delete leave a gap between them. A player could start a round that picks the
question inside that gap, and the delete would then remove a question a round uses. Postgres checks
the rule inside the delete itself, so there is no gap.

</details>
<details>
<summary>3. In an edit with a new photo, why is the old photo deleted last?</summary>

So the question never points at a photo that doesn't exist. If the old photo went first and the
row update then failed, the quiz would show a broken image. Deleting it last means the worst case is
a leftover photo nobody sees.

</details>
<details>
<summary>4. Why does `deletePhoto` log its error, while `uploadQuestionPhoto` throws?</summary>

The upload happens before the database write, so if it fails nothing should be saved. The delete
happens after the database has changed: the job is done, and throwing would report a failure that
didn't happen.

</details>
<details>
<summary>5. What would go wrong with an inner join in `listUsers`?</summary>

Admins have no score row, so an inner join, which keeps only users with a match, would drop every
admin from the list. A left join keeps them, with `null` tokens and level.

</details>
<details>
<summary>6. An admin searches for `50%`. What does `containsPattern` send, and why?</summary>

`%50\%%`. The outer `%` signs mean "anything before and after"; the backslash before the admin's
`%` makes it a real percent sign. Without it, `50%` would match "50" followed by anything.

</details>
