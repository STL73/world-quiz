# Phase 2b: the core game

Phase 2b makes the quiz playable through the API. A logged-in player starts a round of 10
questions, sees each one with its answers shuffled, can take the hint, answers, earns tokens by the
spec's rules, can leave and come back, can give up, and sees the results. Admins can't play. The
React pages that use all this come in phase 3. This note has one section per file, in the order
the files were written.

## Test files one at a time

### `vitest.config.js`

One setting changed:

```js
// One file at a time: a round picks from every question on the test branch, so a file
// adding questions must not run beside one playing rounds
fileParallelism: false,
```

Vitest normally runs test files side by side to save time. That was safe while every file kept to
its own rows. A round is different: `POST /rounds` picks from **every** question on the `test`
branch. If `schema.test.js` ran beside `rounds.test.js`, a round could pick a question the schema
test had just added. The schema test's clean-up would then try to delete a question that had been
played, and the `restrict` rule (below) would refuse it.

The cost: the suite went from 21.3 s to 35.0 s when this was added, and is about 43 s now with the
new tests. Vitest offered `isolate: false` to win back about 6 s; it wasn't taken, because it lets
test files share loaded code, and one file's leftovers could then change another's results.

## The schema

### `src/db/schema/game.js`

The migration `drizzle/0002_add_rounds.sql` made these changes on both Neon branches.

Two tables. A **round** is one game; a **round question** is one of its 10 questions and how the
player answered it.

| `rounds` column | Meaning |
| --- | --- |
| `round_id` | The id, counting up |
| `user_id` | Whose round. Deleting the player deletes their rounds (`cascade`) |
| `status` | `active`, `finished` or `abandoned` (the enum `round_status`) |
| `started_at`, `finished_at` | When it began and ended. `finished_at` is empty while it's active |

| `round_questions` column | Meaning |
| --- | --- |
| `round_id` | Which round. Deleting the round deletes its questions (`cascade`) |
| `position` | 1 to 10, the question's place in the round |
| `question_id` | Which question. A played question can't be deleted (`restrict`) |
| `answer_order` | The shuffle, e.g. `{3,1,2}`: button *n* shows stored answer `answer_order[n - 1]` |
| `shown_at` | When the player first opened it |
| `answered_at`, `chosen_answer`, `correct` | The answer: when, which stored answer, right or not |
| `hint_used` | Whether the hint was taken |
| `tokens_awarded` | What this answer earned |

Notice what isn't stored: the position the player is on, the streak, and the round's total. All
three are worked out from the rows (the first unanswered position, the run of `correct` at the
end, the sum of `tokens_awarded`). A stored copy could disagree with the rows; a calculated one
can't.

**The rules the database enforces**, so they hold for every route and any future script:

| Rule | Kind | Error code |
| --- | --- | --- |
| One active round per player, any number of ended ones | partial UNIQUE index, `WHERE status = 'active'` | `23505` |
| An ended round has `finished_at`, an active one doesn't | CHECK | `23514` |
| `position` 1 to 10, `chosen_answer` 1 to 3, tokens not negative | CHECK | `23514` |
| `answer_order` is 1, 2 and 3, each once | CHECK: three items that contain 1, 2 and 3 | `23514` |
| `answered_at`, `chosen_answer` and `correct` are all set or all empty | CHECK | `23514` |
| The same question at most once per round, one question per position | UNIQUE | `23505` |
| A played question can't be deleted | foreign key, `ON DELETE RESTRICT` | `23001` |

The partial index is the clever one. An ordinary UNIQUE on `user_id` would allow one round per
player, ever. Adding `WHERE status = 'active'` means only active rows go into the index, so it
says "at most one active round each" and ignores every finished one.

`scores.saved_question_id` was dropped in the same migration: it was the old way of remembering
where a player was, and `rounds` replaces it.

### `tests/schema.test.js`

Each rule above is broken on purpose and the test checks Postgres's error code. One surprise came
from it: deleting a played question was refused, as designed, but with `23001`
(`restrict_violation`), not the `23503` the plan expected. `23503` is what a foreign key with no
`ON DELETE` rule gives; `ON DELETE RESTRICT` has its own code. The test expects `23001`.

## Scoring

### `src/lib/scoring.js`

Three functions and four numbers. No database, so the tests run in milliseconds.

| Function | Takes | Gives back |
| --- | --- | --- |
| `nextStreak(streakBefore, correct)` | the streak so far, right or wrong | the new streak: +1, or 0 |
| `streakOf(answers)` | a list of answers, oldest first | the streak at the end |
| `tokensFor({ correct, firstTime, hintUsed, streak })` | one answer's facts | its tokens |

`tokensFor` works in three steps: wrong or a repeat earns 0 and stops there, so a repeat can't
earn the bonus either; otherwise the base is 10, or 5 with the hint; then 5 more if the streak has
reached 3. `streak` includes the answer being scored, so the 3rd right answer in a row arrives
with `streak: 3` and gets the bonus.

`streakOf` uses `reduce`, which carries a running value down a list like a total down a column:
`[right, wrong, right, right]` goes 0 → 1 → 0 → 1 → **2**.

The streak is passed in rather than remembered. That keeps `tokensFor` a calculator: the same
input always gives the same output, which is what lets the test check exact numbers.

### `tests/scoring.test.js`

Six tests, ending with the spec's worked example and the best possible round:

| Answer | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kind | right | right | right | right | **wrong** | right | **hint** | right | right | right |
| Streak | 1 | 2 | 3 | 4 | 0 | 1 | 2 | 3 | 4 | 5 |
| Tokens | 10 | 10 | 15 | 15 | 0 | 10 | 5 | 15 | 15 | 15 |

Total **110**. Ten right answers: 10 + 10 + 8 × 15 = **140**. The helper `playRound` plays a list
the way the answer route does: new streak first, then that answer's tokens.

## Picking and shuffling

### `src/lib/picking.js`

| Name | What it is |
| --- | --- |
| `ROUND_SIZE` | 10 |
| `shuffle(items, random)` | a shuffled copy of a list |
| `pickQuestions(allIds, correctIds, random)` | the question ids for a new round |
| `shuffleAnswers(random)` | the order to show a question's 3 answers in |

**`shuffle` is the Fisher–Yates shuffle.** It copies the list, then walks from the last position
to the second, swapping each item with a random one at or before it. Five cards, with made-up
random numbers:

| `i` | random | `j = floor(random × (i+1))` | Swap | List after |
| --- | --- | --- | --- | --- |
| 4 | 0.3 | 1 | E ↔ B | `[A, E, C, D, B]` |
| 3 | 0.9 | 3 | D with itself | `[A, E, C, D, B]` |
| 2 | 0.1 | 0 | C ↔ A | `[C, E, A, D, B]` |
| 1 | 0.6 | 1 | E with itself | `[C, E, A, D, B]` |

Like drawing names from a hat for the last seat, then the second-last, and so on: every order is
equally likely. The well-known one-liner `list.sort(() => Math.random() - 0.5)` looks the same but
isn't fair. `sort` expects a comparison that gives the same answer for the same pair, and coin
flips confuse it, so some orders come up more often than others.

`random` is `Math.random` unless a test passes its own. Passing in what a function depends on,
instead of reaching for it inside, is called dependency injection; here it lets a test get a
predictable shuffle.

**`pickQuestions`**, with 15 questions and 1 to 8 already answered right:

1. `unseen` = 9 to 15, shuffled: `[12, 9, 15, 11, 14, 10, 13]`
2. `repeats` = 1 to 8, shuffled: `[5, 2, 7, 1, 8, 3, 6, 4]`, so which repeats get in is random
3. Unseen first, keep 10: `[12, 9, 15, 11, 14, 10, 13, 5, 2, 7]`
4. Shuffle again: `[9, 5, 14, 12, 2, 10, 15, 7, 11, 13]`

Without step 4, repeats would always be the last questions and the end of a round would be easy.
With only 3 questions in the database, `slice(0, 10)` keeps all 3 and invents none.

**`shuffleAnswers`** is `shuffle([1, 2, 3])`. The spec's example: stored answers
`[Paris, Lyon, Nice]`, order `[3, 1, 2]`, so the buttons show Nice, Paris, Lyon. Clicking button 2
means `order[1]` = stored answer 1, Paris.

### `tests/picking.test.js`

Random code is tested by running it many times (`RUNS = 200`): one lucky pass proves little, 200
in a row don't happen by luck. The tests check unseen questions always get in, repeats sometimes
come first, a round never invents questions, a player who has answered everything still gets 10,
all 6 answer orders turn up, the input list is left alone, and a fake `random` gives a known
result.

## Validation

### `src/validation/rounds.js`

| Schema | Checks | Example |
| --- | --- | --- |
| `answerSchema` | `choice` is a whole number 1 to 3 | `{ choice: 2 }` passes; `'2'`, `0`, `4`, `2.5` don't |
| `roundParamsSchema` | the address's `id` becomes a positive whole number up to 2147483647 | `'12'` → `12`; `'abc'`, `'0'`, `'1.5'` don't |

`choice` is the **button**, counted from the left as the answers are shown, never the stored
answer number. The browser never learns the shuffle, so it can't send a stored number, and
someone reading the browser's network traffic learns nothing from the buttons either.

`z.coerce.number()` converts before checking, because everything in an address is text. Only the
id needs it: the answer arrives as JSON, which has real numbers, so a text `'2'` there means
something odd is sending it and is refused rather than quietly fixed.

The upper limit is Postgres's largest `integer`. Without it, a huge id typed into the address bar
would reach Postgres, fail as "out of range" and come back as a 500, which looks like a crash.

Through `validate()`, a failure is a 400:

```json
{ "error": { "message": "Invalid input",
             "details": [{ "path": "body.choice", "message": "Choose answer 1, 2 or 3." }] } }
```

## Starting and showing a round

### `src/lib/rounds.js`: `startRound` and `currentRound`

**`startRound(userId)`** is what pressing Play does:

1. Every question id. None at all: 409, "There are no questions to play yet"
2. The questions this player has ever answered right (`selectDistinct`, joined to `rounds`
   because only `rounds` knows whose round it was)
3. `pickQuestions` chooses 10
4. One `db.batch`: insert the round, then 10 `round_questions` rows, each with its own
   `shuffleAnswers()`

The rows need the round's id, which doesn't exist until the first insert runs, and both inserts go
to Neon in one trip. So each row carries a subquery instead of a number:

```sql
insert into "round_questions" (..., "round_id", "position", "question_id", "answer_order", ...)
values (default, (select "rounds"."round_id" from "rounds"
                  where "rounds"."user_id" = $1 and "rounds"."status" = 'active'),
        $2, $3, $4, default, ...)
params: [7, 1, 42, '{3,1,2}']
```

It's the same pattern as `createPlayer`, where the score row finds its user by email. Here "the
player's active round" is unique because the partial index makes it so.

**Two Play clicks at once.** Both can pass steps 1 to 3 together. When both insert an active
round, the partial index lets only one through; the other gets `23505`, which the `catch` turns
into a 409, "You already have a round in play", and its whole batch rolls back. The `try/catch` is
in `lib/` because `api.md` keeps routes free of them.

**`currentRound(userId)`** finds the active round and its rows in order (404 with none), takes the
first unanswered row, records `shown_at` the first time, and builds the response field by field:

```json
{ "roundId": 185, "position": 1, "total": 10,
  "question": { "imageUrl": "https://res.cloudinary.com/...", "text": "Which park is this?",
                "answers": ["Hyde Park", "Prospect Park", "Central Park"], "hint": null },
  "tokensEarned": 0, "streak": 0 }
```

Writing out each field means nothing is sent by accident: the question row also holds
`correctAnswer`, and sending the row whole would give it away. The answers are words, not numbers.
The hint shows only once it's been taken, so a page refresh keeps a hint the player paid for.

### `src/routes/rounds.routes.js` and `src/app.js`

```js
roundsRouter.use(requireAuth, requireRole('user'));
```

`router.use` puts both guards in front of every route in the file: a doorman at the entrance
instead of one at each room. No login is 401; an admin is 403. `app.js` mounts the router at
`/api/v1/rounds`, before `notFound` and `errorHandler`.

| Request | Answer |
| --- | --- |
| `POST /api/v1/rounds` | 201 with question 1, saving the browser a second request |
| `GET /api/v1/rounds/current` | 200 with where the player left off, 404 with no round |

### `tests/rounds.test.js`

`beforeAll` adds a made-up country and 12 questions whose right answers are spread over 1 to 3, so
code that always reads answer 1 can't pass. 12, so a second round has 2 unseen questions after a
first round of 10. `afterAll` deletes players first (their rounds go with them), and only then the
questions, which `restrict` would otherwise protect.

The test reads the right answer **from the database** (`currentRow`, `rightChoice`), because the
API never says before the player answers. `rightChoice` turns the stored right answer into a
button: order `[3, 1, 2]` and right answer 1 give button `indexOf(1) + 1` = 2.

The test for two Play clicks sends both with `Promise.all` and expects one 201 and one 409, and
one active round in the database.

## The hint and giving up

### `openRow`

The question on the player's screen: the first unanswered row, **and it must have `shown_at`**.
Without that, a double click that arrives late does damage:

| Moment | What happens |
| --- | --- |
| 1 | Question 4 is on screen (`shown_at` set) |
| 2 | The first click answers question 4 |
| 3 | The second click arrives after the first finished. The current question is now 5, never seen |

With `openRow`, question 5's `shown_at` is still empty, so the second click gets 409, "That
question has already been answered". From the player's side, that's what happened.

### `useHint`

Finds the open question, sets `hint_used` if it isn't set, and returns `{ hint }`. Asking again
returns the same hint and writes nothing. The hint is recorded on the server because it costs 5
tokens: a hint the browser kept to itself couldn't halve anything.

### `abandonRound`

One `UPDATE ... WHERE user = this player AND status = 'active'`, setting `abandoned` and
`finished_at` together (which the CHECK requires). `.returning()` gives back the changed row;
none means no round was in play, a 404. Two give-up clicks at once can't both succeed. The tokens
already earned stay.

### `roundSummary`

An ended round's results. The one query carries all three conditions:

```js
where roundId = 185 AND userId = this player AND status != 'active'   // ne = "not equal"
```

Someone else's round, a round in play, and a round that doesn't exist all give the same 404,
"Round not found". Checking the owner in the same query means there's no "not yours" answer to
tell a snooper the round exists. A round in play has no results because they would show the
answers still ahead.

Per question, the summary sends words, not numbers, and hides what the player never reached:

| Field | Answered | Not answered |
| --- | --- | --- |
| `correctAnswer` | the right answer's text, e.g. "Central Park" | `null`: it comes back as unseen later |
| `chosenAnswer` | the text the player picked | `null` |
| `correct` | true or false | `null` |

If giving up showed every answer, a player could give up, read all 10, and score full marks next
round.

The two routes are `POST /current/hint` and `POST /current/abandon`. Both are `POST` because they
change data: a `GET` must never change anything, and browsers and link previews fetch `GET`
addresses freely.

## Answering

### `answerQuestion`

The player clicks button 2; the stored answers are `[Paris, Lyon, Nice]`, the order `[3, 1, 2]`,
the right answer 1; the streak so far is 2, no hint.

| Line | Works out | Value |
| --- | --- | --- |
| `activeRound` + `openRow` | the question on screen | question 4 |
| `rq.answerOrder[choice - 1]` | button 2 → `order[1]` | stored answer 1 |
| `chosenAnswer === question.correctAnswer` | 1 === 1 | correct |
| `nextStreak(2, true)` | | streak 3 |
| `answeredRightBefore` | ever right in an earlier round? | no, so first time |
| `tokensFor(...)` | 10 + 5 bonus | 15 |

Nothing is saved yet. Saving is one statement, here as Postgres receives it (round question 501,
user 7):

```sql
with "answered" as (update "round_questions"
    set "answered_at" = $1, "chosen_answer" = $2, "correct" = $3, "tokens_awarded" = $4
    where "round_question_id" = $5 and "answered_at" is null and "hint_used" = $6
    returning "tokens_awarded")
update "scores"
    set "star_tokens" = "scores"."star_tokens" + "answered"."tokens_awarded"
    from "answered"
    where "scores"."user_id" = $7
    returning "scores"."star_tokens"
```

The `with "answered"` part is a **CTE**, a named step inside one statement. It saves the answer
only while the row is unanswered and the hint is as it was read, and returns one row if it saved,
none if it didn't. The scores update joins to it (`from "answered"`), so no row means no tokens
added. Saving the answer and paying for it can't come apart.

If `added` comes back empty, the statement saved nothing, and the player gets 409.

**`finishIfDone`** goes in the same `db.batch()`: the round becomes `finished` only if no
unanswered question is left (`notExists`). After answer 4 it changes nothing; after answer 10 it
closes the round. Same batch, same transaction, so it sees the answer just saved.

The response:

```json
{ "correct": false, "correctChoice": 3, "tokensEarned": 0, "streak": 0, "starTokens": 0 }
```

`correctChoice` is the button that was right, so the page can light it green. The 10th answer also
carries `summary`, the round's results.

The route sends only `{ "choice": 2 }`. The server already knows which question is on screen, so
the browser has nothing it could lie about: it can't answer a question it was never shown, or one
from another round.

## A round's results

### `GET /:id`

```js
roundsRouter.get('/:id', validate({ params: roundParamsSchema }), async (req, res) => {
    res.json({ data: await roundSummary(req.user.userId, req.valid.params.id) });
});
```

`/:id` is a placeholder that matches any one word. Express tries routes top to bottom, so this
route sits after the `/current` ones: above them, `/rounds/current` would be read as the round
with id `current` and refused as invalid.

### The live check

The real server on port 5600, Arcjet on, the `dev` database, 2026-11-23:

| Step | Answer |
| --- | --- |
| Sign-up with a `mailinator.com` address | 400 on `body.email`: "This email address can't be used. Please use another one." |
| Sign-up with an `outlook.com` address | 201 |
| Start a round | 201, 1 of 10, "Which park is this?", Hyde Park / Prospect Park / Central Park |
| The hint | "An 843-acre urban oasis carved into the heart of the most photographed city skyline." |
| Answer button 1 | 200, wrong, `correctChoice: 3`, 0 tokens |
| The same answer again, before opening the next | 409 |
| Open the next question | 2 of 10 |
| Give up, then the results | 200 abandoned, then 200 |
| The Cloudinary photo | 200, `image/jpeg`, 268 KB |

It was the first live run of the sign-up email guard. The check's account was deleted afterwards,
leaving `dev` with the admin only.

## How the files connect

One answer:

```text
button 2 pressed ── POST /api/v1/rounds/current/answer  { "choice": 2 } ──▶ app.js
                                      │  helmet → Arcjet → express.json → cookieParser
                                      ▼
                          requireAuth, requireRole('user')    middleware/auth.js
                                      │  no login → 401, admin → 403
                                      ▼
                          validate({ body: answerSchema })    validation/rounds.js
                                      │  not 1 to 3 → 400
                                      ▼
                          answerQuestion                      lib/rounds.js
                                      │
                                      ▼
                          activeRound                         round + 10 rows, in order
                                      │  none → 404
                                      ▼
                          openRow                             first unanswered, shown_at set
                                      │  not opened → 409
                                      ▼
                          scoring.js                          nextStreak, tokensFor
                                      │
                                      ▼
                          one db.batch:  addTokens (the CTE)  +  finishIfDone
                                      │  nothing saved → 409
                                      ▼
                          { correct, correctChoice, tokensEarned, streak, starTokens, summary? }
```

## One round end to end: Maria plays

Maria is logged in with 0 tokens and has never played.

1. **She presses Play.** `POST /rounds`: 10 questions picked, all unseen, each with its answers
   shuffled. 201 with question 1, which is now marked shown
2. **Question 1, right.** Streak 1, 10 tokens
3. **Question 2: she takes the hint**, then answers right. Streak 2, but 5 tokens, not 10
4. **Questions 3 and 4, right.** Streak 3 and 4, so the bonus starts: 15 each
5. **Question 5, wrong.** 0 tokens, streak back to 0, and the response's `correctChoice` shows her
   the right button
6. **She closes the browser** and comes back the next day. `GET /rounds/current` puts her on
   question 6, with 45 tokens and streak 0, all worked out from the saved rows
7. **Question 6, right**, streak 1: 10. **Question 7, right**, streak 2: 10
8. **Questions 8, 9 and 10, right**, streaks 3, 4 and 5: 15 each. The 10th answer finishes the
   round and comes back with the results

| Question | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tokens | 10 | 5 | 15 | 15 | 0 | 10 | 10 | 15 | 15 | 15 |

**9 / 10, 110 tokens**: the same total as the spec's worked example, which takes the hint on
question 7 instead. In both, the hint falls on a streak of 2, before the bonus, so it costs 5
either way. Her next round puts every question she got wrong, and the 36 she hasn't seen, ahead of
the 9 she knows.

## Two clicks, one answer

When Postgres updates a row, it **locks** it until the transaction ends. Another update to the
same row waits. Like one till receipt and one pen: the second cashier waits for the first to put
it down.

| Time | Request A | Request B |
| --- | --- | --- |
| 1 | reads the row: unanswered, works out 10 tokens | reads the row: unanswered, works out 10 tokens |
| 2 | updates row 501: unanswered, so it saves and locks the row | updates row 501: waits for A's lock |
| 3 | adds 10 to the score, commits, releases the lock | |
| 4 | | re-checks the row as it is now: `answered_at` is set, so it updates nothing |
| 5 | 200 | `answered` is empty, the score update does nothing: 409 |

Step 4 is the point. The waiting update re-checks its `WHERE` against the row A just saved, not
the copy B read at step 1. That's why the check lives inside the update: a separate "is it
answered?" read beforehand would have said no to both.

Proven twice. The test `scores two answers sent at the same moment once` expects one 200, one
409 and 10 tokens. That result has two possible causes: the lock, or `openRow` if A finished
before B read anything. So a throwaway script also ran the race 10 times and counted how many
requests reached the database write: both did, all 10 times, and the score was 10 every time. The
lock is what decided it.

## Check yourself

<details>
<summary>1. Why does the browser send a button number and not the answer, or the question?</summary>

The browser never knows the shuffle, so it can't know which stored answer a button shows, and
neither can anyone watching its traffic. It doesn't name the question either: the server knows
which question is on screen, so the browser can't answer one it wasn't shown or one from another
round. The server translates the button through `answer_order`.

</details>
<details>
<summary>2. Why is the streak never stored?</summary>

It can always be worked out from the saved answers: the run of right answers at the end of the
round (`streakOf`). A stored copy would have to be kept in step with every answer, and the first
time it wasn't, the player would get the wrong bonus. Worked out, it's right even after leaving
and coming back the next day.

</details>
<details>
<summary>3. What would go wrong if the scores update were a separate statement in the batch?</summary>

It couldn't tell whether this request's answer update saved a row. Two requests at once would
both reach the scores update and both add 10: 20 tokens for one answer. Inside one statement, the
scores update reads the CTE's `RETURNING`, which is empty for the request that saved nothing.

</details>
<details>
<summary>4. Why does a round in play have no results page?</summary>

The results show each question's right answer. A player could open them mid-round and read the
answers to the questions still ahead. So `roundSummary` asks for `status != 'active'`, and a
round in play gives 404.

</details>
<details>
<summary>5. Why does a given-up round hide the answers it never reached?</summary>

Unanswered questions count as unseen and come back in later rounds. Showing their answers would
let a player give up, read them all, and score full marks next time.

</details>
<details>
<summary>6. Two Play clicks arrive at the same instant. What makes sure only one round starts?</summary>

The database, not the code. Both requests can check "is there a round?" before either has made
one. But the partial UNIQUE index on `rounds` allows one active round per player, so the second
insert fails with `23505`, its batch rolls back with its 10 question rows, and `startRound` turns
the error into a 409.

</details>
