# World Quiz: core game design

Date: 2026-11-17. Status: approved in conversation, awaiting review of this written version.

Part of the React rebuild (`2026-11-15-react-rebuild-design.md`). This spec replaces that
spec's parity game rules. It covers phase 2b, the core game. Auth (2a) and admin CRUD (2c) get
their own plans.

## Goal

Replace the PHP version's endless list of questions with a fair, round-based game, built on the
46 questions already in Neon, and deploy it as the first live version. The world map, collections,
fact cards and new content are added after that, each designed in its own discussion.

## Why the game changes

- The PHP version serves every question in id order (`get_question.php`,
  `WHERE id > ? ORDER BY id LIMIT 1`), so every player sees the same sequence
- The correct answer is answer 1 in 37 of the 46 questions, which the phase 1 import showed
- A player can answer the same question again and earn tokens again (`check_answer.php` has no
  guard)

## Decisions

| Decision | Choice |
| --- | --- |
| Order of work | A core game first, deployed; map, collections, fact cards and content later (option A) |
| A round | A fixed 10 questions, always played to the end. Lives and survival come later as extra modes |
| Picking questions | Questions not yet answered correctly come first; the rest are random repeats |
| Repeats | Count for the result and the streak, earn no tokens |
| Answer order | Shuffled per round; the server keeps the shuffle |
| Leaving mid-round | The round is saved; Play continues it; a Give up button abandons it |
| Admins | Do not play; the play routes need the `user` role |
| Storage | Two tables, `rounds` and `round_questions` (option 1) |

## Scoring

| Rule | Value |
| --- | --- |
| Starting tokens | 0 (the PHP version gave 10) |
| Correct, first time | +10 |
| Correct with the hint | +5. The hint does not break the streak |
| Wrong answer | 0, no penalty |
| Streak bonus | +5 extra for each correct answer from the 3rd in a row |
| Repeat question | 0 tokens, bonus included |
| Level | `floor(star_tokens / 100) + 1`, unchanged |

Definitions:

- **First time** means no earlier `round_questions` row for this player and question has
  `correct = true`. A question answered wrongly before still earns tokens the first time it is
  answered correctly
- **Streak** is the number of correct answers in a row within the round, repeats included. A
  wrong answer resets it to 0. It is worked out from `round_questions`, not stored
- Tokens are added to `scores.star_tokens` when each answer is checked, not at the end of the
  round, so an abandoned round keeps what it earned

Worked example, all first-time questions: ✓ ✓ ✓ ✓ ✗ ✓ ✓(hint) ✓ ✓ ✓

| Questions | Tokens |
| --- | --- |
| 1–2 | 10 + 10 = 20 |
| 3–4 | (10 + 5) + (10 + 5) = 30 |
| 5 | 0, streak reset |
| 6–7 | 10 + 5 (hint) = 15 |
| 8–10 | (10 + 5) × 3 = 45 |
| **Total** | **110 tokens, 9 / 10** |

The best round is 10 first-time correct answers without hints: 100 + 8 × 5 = 140. A perfect
player earns 640–650 tokens from the 46 questions, which is level 7: four rounds of 10 unseen
questions at 140 each (560), then a fifth round whose 6 unseen questions earn 80–90 depending on
where the 4 repeats fall. New content raises that ceiling.

A perfect-round bonus is left out because repeats would let players farm it. It fits the
collections phase as a badge.

## Picking and shuffling

- When a round starts, the server picks all of its questions at once: random questions the
  player has not yet answered correctly first, then random others to fill the round
- A round has 10 questions, or every question if fewer than 10 exist
- Each question gets a random `answer_order`, a permutation of `[1, 2, 3]`. Display position *n*
  shows stored answer `answer_order[n - 1]`. Example: stored answers `[Paris, Lyon, Nice]`, order
  `[3, 1, 2]`, so the player sees Nice, Paris, Lyon; clicking the 2nd button means stored
  answer 1
- Picking and shuffling are pure functions in their own file, tested without the database

## Data model

New tables:

| Table | Columns | Notes |
| --- | --- | --- |
| `rounds` | round_id, user_id (FK, cascade), status (`active` / `finished` / `abandoned`), started_at, finished_at | `round_status` enum. The current position, streak and round total are worked out from `round_questions` |
| `round_questions` | round_question_id, round_id (FK, cascade), position, question_id (FK, restrict), answer_order (integer array), shown_at, answered_at, chosen_answer, hint_used, correct, tokens_awarded | One row per question in a round |

Rules in the database:

- One active round per player: a partial UNIQUE index on `rounds (user_id)` where
  `status = 'active'`
- `round_questions`: UNIQUE `(round_id, position)` and UNIQUE `(round_id, question_id)`;
  `position` 1 to 10; `chosen_answer` 1 to 3; `tokens_awarded` 0 or more; `answer_order` holds
  exactly 1, 2 and 3
- A question that has been in a round can't be deleted (restrict). Admin CRUD hides questions
  instead

Changes to existing tables, in one new migration whose SQL Slav sees before it is applied:

- `scores.star_tokens` defaults to 0 instead of 10
- `scores.saved_question_id` is dropped: the active round is the saved place
- These two tables replace the `attempts` table the rebuild spec planned

## API

Every route needs a logged-in user with the `user` role. Admins get 403.

| Endpoint | Does | Status |
| --- | --- | --- |
| `POST /api/v1/rounds` | Starts a round: picks the questions and shuffles each one | 201; 409 if a round is active |
| `GET /api/v1/rounds/current` | The active round: position (e.g. 4 of 10), photo, question, the 3 answers in shuffled order, tokens and streak so far. Never the correct answer. Records `shown_at` the first time a question is shown | 200; 404 if none |
| `POST /api/v1/rounds/current/hint` | Returns the current question's hint and records `hint_used`. Calling it again returns the same hint | 200; 404 if none |
| `POST /api/v1/rounds/current/answer` | Body `{ "choice": 1-3 }`, the display position. Returns whether it was right, the right display position, tokens earned, streak and new total. On the last question it also returns the round summary and finishes the round | 200; 400; 404; 409 if already answered |
| `POST /api/v1/rounds/current/abandon` | Marks the round abandoned; earned tokens stay | 200; 404 if none |
| `GET /api/v1/rounds/:id` | A finished or abandoned round's results | 200; 404, also for another player's round |

The answer route always applies to the current position, so the browser never says which
question it is answering. An answer is saved only while `answered_at` is still empty, so a double
click earns once and the second request gets 409. Two Play clicks at once hit the partial UNIQUE
index (`23505`), which the route turns into 409.

### Open for the plan

An answer updates `round_questions`, `scores` and, on the last question, `rounds`. The
`neon-http` driver has no interactive transactions. The plan must check how `manchester-event`
handles multi-table writes (for example `db.batch()`) and choose how the answer route stays
consistent. Not decided here; confidence in any one approach is low until that is checked.

## Errors and validation

- Zod checks `{ "choice" }`: a whole number from 1 to 3, or 400
- No active round where one is needed: 404. Already answered: 409. Admin on a play route: 403
- All thrown as `AppError`, no try/catch in routes (`api.md`)

## Tests

Written first, on the Neon `test` branch, with Vitest and Supertest:

- **Scoring (pure):** first time, hint, streak bonus from the 3rd correct answer, reset on a
  wrong answer, repeats earning 0, and the worked example above (9 / 10, 110 tokens)
- **Picking and shuffling (pure):** not-yet-correct questions first, never more questions than
  exist, every shuffle a permutation of 1, 2, 3
- **Routes:** a full round from start to summary; continuing an active round; abandoning; the
  double-answer 409; the second-round 409; an admin getting 403; another player's round giving
  404; the correct answer never appearing in `GET /rounds/current`
- **Database rules:** each broken on purpose and checked by its code (`23505`, `23514`, `23503`)

## Phases

This replaces the rebuild spec's phase table.

| # | Phase | Sessions (2–3 h) |
| --- | --- | --- |
| 0–1 | Setup, schema, import | done |
| 2a | Auth: sign-up, login, sessions, role checks, password rules | 3–4 |
| 2b | Core game (this spec) | 4–6 |
| 2c | Admin CRUD for questions and users, plus admin preview mode | 2–3 |
| 3 | Visual direction: HTML previews, Slav chooses | 1–2 |
| 4 | React frontend for 2a–2c | 8–12 |
| 5 | Deploy to Railway: first live URL | 2–3 |
| 6 | Cutover: remove PHP `src/`, with approval | 1 |
| 7 | Leaderboard | 1–2 |
| 8 | Admin image upload | 2–3 |
| 9 | Content: question categories, free sources and licences, a credit per image, new questions | 3–5, then ongoing |
| 10 | Fact cards after each answer | 2–3 |
| 11 | World map: levels unlock countries, play by region | 4–6 |
| 12 | Collections: passport, badges, flags, map puzzle | 4–6 |
| 13 | Timed rounds, then lives and survival modes | 2–4 |

About 40–60 sessions in all, roughly 4 to 5 months at three sessions a week. The first live URL
comes after phase 5, about 17 to 27 sessions from 2026-11-17. Phases 4, 11 and 12 are the
likeliest to overrun. Content comes before the map and collections because 16 countries and 46
questions are too few to make either worthwhile.

## Ideas kept for later phases

Slav's ideas from 2026-11-17, each to be designed in its own phase:

- **Levels unlock countries** on the world map, starting from one; once every country is open,
  question types unlock features (phase 11)
- **Wider content:** culture, food and objects, not only landmarks, so the game doesn't repeat
  the same famous buildings (phase 9)
- **Collections:** badges for rounds and difficulty, pins, country flags (phase 12)
- **Fact cards** about the photo or the country, so players learn as well as play; possibly
  collectable (phase 10)
- **Map puzzle:** each correct answer adds a piece of a country or continent map; a finished map
  gives a bonus or a fact (phase 12)
- Suggested and liked: a **passport** screen that brings countries, stamps, flags, badges and
  puzzle pieces together; a fact card after every answer, right or wrong; missed questions
  coming back later
- **Free sources to check in phase 9**, from memory and not yet verified: REST Countries and
  flagcdn.com (flags and country data), Natural Earth through `world-atlas` (map shapes),
  Wikidata (CC0 facts), Wikipedia (credit and share-alike), Wikimedia Commons, Unsplash and
  Pexels (photos, licence per image)

## Out of scope for 2b

The frontend (phase 4), the leaderboard, timed rounds, lives, collections, fact cards, new
content and categories, admin preview mode (2c) and password rules (2a).
