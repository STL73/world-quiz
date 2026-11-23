# World Quiz: visual direction

Date: 2026-11-23. Status: approved in conversation, awaiting review of this written version.

Phase 3 of the React rebuild (`2026-11-15-react-rebuild-design.md`, phase table in
`2026-11-17-core-game-design.md`). It fixes how the game looks before phase 4 builds the React
frontend. Slav chose each part from HTML previews built on the real `dev` data; the chosen pages
are kept in `docs/superpowers/previews/`.

## Decisions

| Decision | Choice |
| --- | --- |
| Device | Phone first: designed at 360px wide, then centred on wider screens |
| Mood | Night explorer: dark navy, teal and coral, glassy panels (preview `1-mood.html`, option C) |
| Question screen | Photo edge to edge across the top, answers on a sheet overlapping it (`2-question-layout.html`, option 2) |
| After an answer | A result panel that names the answer and explains the tokens (`3-answer-result.html`, option B) |
| End of a round | Score, ten squares and the level bar first, the review list below (`4-round-summary.html`, option C) |
| Admin question list | List rows that fold into two lines on a phone (`5-admin-list.html`, option A) |
| Fonts | Space Grotesk for headings and numbers, Inter for the rest, self-hosted through `@fontsource-variable` |
| Not previewed | Home, log in and sign up, and laptop widths: built to the rules below and checked in phase 4 |

## Colours

Each colour has one meaning. Coral means wrong and nothing else, so the streak, coral in the
previews, moves to gold.

| Token | Value | Means |
| --- | --- | --- |
| `bg` | `#0b1424`, with a radial glow of `#173a5e` at the top | Page background |
| `surface` | `#0f1d33` | The answer sheet and panels |
| `text` | `#e8f1ff` | Main text |
| `muted` | `#8ea3c0` | Secondary text, labels |
| `teal` | `#3ee6c4` | A right answer, the main button, progress, stars |
| `coral` | `#ff7a59` | A wrong answer, Delete |
| `gold` | `#ffd166` | The streak, level up, the hint marker |

Lines and quiet fills are white at low opacity: `rgba(255,255,255,.06)` for an answer button,
`.14` for its border.

Contrast, checked against WCAG AA (4.5 : 1 for body text):

| Pair | Ratio |
| --- | --- |
| `text` on `bg` | 16.19 |
| `muted` on `bg` | 7.15 |
| `muted` on `surface` | 6.55, the lowest |
| `teal` on `surface` | 10.71 |
| `coral` on `surface` | 6.58 |
| `gold` on `surface` | 11.71 |
| `bg` text on `teal` (main button) | 11.69 |
| `bg` text on `gold` (level-up badge) | 12.78 |

The tokens go in `frontend/src/App.css` under `@theme`, as `frontend.md` says.

## Type

| Use | Font | Size and weight |
| --- | --- | --- |
| Question, result headline | Space Grotesk | 22–26px, 700 |
| Round score | Space Grotesk | 52px, 700 |
| Header figures (position, stars, streak) | Space Grotesk | 14px, 700 |
| Answers, body | Inter | 15px, 600 for answers |
| Labels | Inter | 12px, 600, upper case, letter-spaced |

Google Fonts is not used: helmet's default Content Security Policy blocks it. The two
`@fontsource-variable` packages serve the fonts from the app itself. Slav approved adding them on
2026-11-23.

## Screens

### Question

- The photo fills the top 290px, edge to edge, with a dark gradient at the top so the header reads
  over any photo
- The header shows the position (`04 / 10`), the stars in teal and the streak in gold
- The sheet starts at 262px, overlapping the photo by 28px, with 24px rounded top corners. It holds
  the question, the open hint (a teal-edged box) and the three answers
- The hint button sits under the answers until it is used
- When the screen is shorter than the content, the photo shrinks and the sheet keeps its content.
  Measured on the longest hint (question 43, 95 characters): 72px spare at 360 × 640, about 8px
  short once a phone's address bar takes its share

### After an answer

The answers make way for a result panel. Keeping them pushed the Next button off a 640px screen.

| Case | Headline | Labels |
| --- | --- | --- |
| Right, first time | ✓ Correct! It's Big Ben. | `+10 first time`, `+5 streak` from the third in a row, `▲ 4 in a row` |
| Right, with the hint | ✓ Correct! | `+5 with hint`, the streak labels as above |
| Right, a repeat | ✓ Correct! | `Seen before · no tokens`, the streak still counts |
| Wrong | ✕ Not this time. You picked Blackpool Tower. It's Big Ben. | `+0`, `Streak reset` |

Every figure comes from the answer response. The panel never works out tokens itself. The labels
do not wrap mid-label. The header's stars and streak update at the same moment.

### End of a round

- At the top: the score (`9 / 10`), the tokens earned, ten squares (teal right, coral wrong, a gold
  ring for a hint) with their key, and the level bar with the stars needed for the next level
- A `Level up!` badge appears only when the round crossed a level
- Home and Play again sit above the fold
- Below them, every question: a small photo, the right answer, and its tokens with the reason
  (`streak bonus`, `with hint`, or the wrong pick)

### Admin question list

- Tabs for Questions and Players, a search box and an Add button
- One row per question: a small photo, the question, the country, the right answer, its state
  (`Not played`, `Played`, `Hidden`) and its actions
- The actions follow the API: Edit and Preview always; Delete for an unplayed question, Hide for a
  played one, Unhide for a hidden one. A hidden row is faded
- Under 600px wide, a row folds into the photo and two lines: the question, then country, answer
  and state, with the actions under them
- Measured: about 10 rows on a 650px-tall laptop screen, 5 on a phone

### Screens not previewed

Phase 4 builds these to the same tokens and checks them in the browser:

- **Home:** the player's name (up to 20 characters), stars and level, and Play, or Continue and
  Give up when a round is saved
- **Log in and sign up:** one centred form on `surface`
- **Laptop widths:** the play screens sit in a centred column about 480px wide; the admin pages use
  the full width up to about 1100px. The question photo at laptop width is the part most likely to
  need a change, because a wide photo in a narrow column is short

## API change

The home screen needs the player's stars and level, and no route returns them today: `GET
/auth/me` returns only the account, and the stars total arrives only in an answer response.

`GET /api/v1/auth/me` will also return `starTokens` and `level` for a player (level =
`floor(starTokens / 100) + 1`, as the admin player list works it out). An admin has no score row,
so both are `null` for an admin. This is the first task of phase 4, with its test written first.

## The previews

`docs/superpowers/previews/` holds the five chosen pages, numbered in the order they were decided.
They were written for the brainstorming companion, which adds the page frame and the click
highlight, so opened on their own they show the phones without that frame. They load the real
photos from Cloudinary. Their states are real data from `dev` except two: the admin list mocks
three questions as played and one as hidden, because `dev` has no rounds yet.

The working files are in `.superpowers/`, now in `.gitignore`.

## Out of scope

Animation details (phase 4 decides them screen by screen, with reduced motion respected), a light
theme, icons beyond lucide-react, the map, passport and fact cards (phases 9 to 11).
