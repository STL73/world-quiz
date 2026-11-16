# Phase 0: the setup

Phase 0 builds nothing a player can see. It builds the pipe that every later feature runs through:
a page in the browser that can ask the API a question, an API that can ask the database, and a test
suite that proves both work. The only visible result is a card reading **API and database: ok**.

## The big picture

```text
Browser (localhost:5173)
   │  fetch("/api/v1/health")
   ▼
Vite dev server ── serves the React files, and forwards anything starting /api ──┐
                                                                                 │
   ┌─────────────────────────────────────────────────────────────────────────────┘
   ▼
Express (localhost:5600)
   helmet → Arcjet → express.json → cookieParser → router → notFound / errorHandler
   │
   ▼
Drizzle (db) ── turns a query into SQL and sends it over HTTPS ──▶ Neon Postgres (cloud)
```

Each layer has one job:

| Layer | Job |
| --- | --- |
| Browser + React | Draws the page and asks the API for data |
| Vite | In development, serves the React files and forwards `/api` requests to Express |
| Express | Receives each request, runs it through the middleware, picks the route that answers it |
| Drizzle | The one way the code talks to the database: builds SQL, sends it, hands back rows |
| Neon | The Postgres database itself, hosted in the cloud |

In production Vite disappears. `npm run build` turns the React code into plain files in
`frontend/dist`, and Express will serve those files itself (phase 5). The browser then talks to one
address for everything, which is the same arrangement the Vite proxy imitates in development.

## Neon branches

A Neon **branch** is a full copy of the database that you can change without touching the others,
in the same way a git branch is a copy of the code. The project has three:

| Branch | Used by | Set in |
| --- | --- | --- |
| `main` | production, once the site is deployed | Railway, phase 5 |
| `dev` | `npm run dev` on your machine | `DB_URL` in `backend/.env` |
| `test` | `npm test` | `TEST_DB_URL` in `backend/.env` |

Tests get their own branch because later tests will create users, answer questions and delete
things. Run against `dev`, they would wreck the data you are clicking through in the browser. Run
against `test`, they can make any mess they like. `tests/setup.js` (below) makes it impossible for a
test to reach `dev` by mistake.

## The backend, file by file

### `backend/package.json`

The package's ID card. Three parts matter:

- `"type": "module"` switches Node to ES modules, so every file uses `import` and `export`. The
  price is that relative imports must include `.js` (`'./app.js'`, never `'./app'`)
- `scripts` are the commands you run with `npm run`: `dev` (nodemon, which restarts the server every
  time you save a file), `start` (plain Node, for production), `test` (Vitest once), `test:watch`
  (Vitest re-running on every save) and `lint` (ESLint)
- `dependencies` are needed to run the app: Express, helmet, cookie-parser, dotenv, Drizzle, the
  Neon driver and Arcjet. `devDependencies` are only needed while building it: nodemon, Vitest,
  Supertest and ESLint

### `src/config/env.js`

Reads the settings from `backend/.env` and hands them to the rest of the app.

- `import 'dotenv/config'` loads `.env` into `process.env`. dotenv never overwrites a variable that
  already exists, which `tests/setup.js` depends on
- It exports `PORT` (default `'5600'`), `NODE_ENV` (default `'development'`) and `ARCJET_KEY`
- **Used by:** `server.js` (the port) and `config/arcjet.js` (the key, and whether this is a test)

One place for settings means a missing setting is spotted in one file, rather than as `undefined`
somewhere deep in a route.

### `src/lib/errors.js`

Defines `AppError`, an error the client is meant to see.

- **Input:** `new AppError(status, message, details)`, for example `new AppError(409, 'Email
  already in use')`
- **What it is:** an ordinary JavaScript `Error` with two extra fields, `status` and `details`.
  `extends Error` means it still behaves like any error, with a message and a stack trace
- **Used by:** routes, whenever they want to refuse a request politely; `notFound`; and
  `arcjetProtect` for 403 and 429

The point of a separate class is the test the error handler can run on it: `err instanceof
AppError`. That one check separates "an error I threw on purpose, safe to show" from "something
broke, hide it".

### `src/middleware/errorHandler.js`

Two functions, both used last in `app.js`.

**`notFound(req, res, next)`** runs only when no router answered. It doesn't send anything itself;
it creates `new AppError(404, 'Not found: GET /api/v1/nowhere')` and passes it on with
`next(error)`. Calling `next` with an argument tells Express to skip straight to the error handler.

**`errorHandler(err, req, res, next)`** is where every error in the app ends up. Express recognises
an error handler by its **four** parameters, so `next` must stay in the list even though it's never
called (hence the `eslint-disable` comment above it). It has three branches:

| The error is | The client receives |
| --- | --- |
| An `AppError` | its own status and `{ error: { message, details? } }` |
| One of `express.json()`'s own (bad JSON, body too large), marked `expose` | its status and message |
| Anything else | `500` and `{ error: { message: 'Something went wrong' } }` |

In the last branch the real error goes to `console.error`, which means the server's terminal, and
never to the client. A database error can contain a connection string or a password; the client
should never see it.

`...(err.details && { details: err.details })` adds a `details` key only when there are details.
If `err.details` is `undefined`, the `&&` gives `undefined`, and spreading `undefined` adds nothing.

### `src/db/index.js`

Creates the one database client, `db`, that every query will go through.

- It checks `process.env.DB_URL` first and throws if it's missing. The server then refuses to start
  rather than starting and failing on the first request. This is called failing fast
- `neon(process.env.DB_URL)` creates the Neon driver. The `neon-http` driver sends each query as an
  HTTPS request, with no connection kept open between queries, which suits a small app on a server
  that may sleep
- `drizzle({ client: sql })` wraps the driver in Drizzle, which builds the SQL for you from
  JavaScript. Tables are described to Drizzle in phase 1
- **Used by:** `health.routes.js` now; every route that touches data later

### `src/routes/health.routes.js`

The only route in phase 0: `GET /api/v1/health`.

```js
healthRouter.get('/', async (req, res) => {
    await db.execute(sql`SELECT 1`);
    res.json({ data: { status: 'ok', database: 'ok' } });
});
```

`SELECT 1` asks Postgres to return the number 1. It reads no table; it only proves the database
answers. If it does, the route sends `{ data: { status: 'ok', database: 'ok' } }`. If it doesn't,
`await` throws, and Express 5 sends the error to `errorHandler` without any `try/catch` in the route.
Express 4 didn't do that for `async` functions, which is why older tutorials wrap every route in
`try/catch`.

The router is mounted at `/api/v1/health` in `app.js`, so its `'/'` means `/api/v1/health` itself.

### `src/config/arcjet.js`

Creates the one Arcjet client, `aj`. Arcjet is an outside security service: for each request, the
app asks Arcjet whether to let it through.

- **Rules:** `shield` looks for common attacks inside the request, such as SQL injection.
  `detectBot` blocks automated clients but allows two categories, search engines and link previews,
  so a quiz link pasted into WhatsApp can still show its preview card. Both are `LIVE`: they block
  rather than only log
- **In tests** `aj` is `null`, because tests run without calling outside services
- It throws at start-up if `ARCJET_KEY` is missing, outside tests
- **Used by:** `security.js`

Arcjet decides development mode from `NODE_ENV=development`, which is why there's no separate
`ARCJET_ENV` setting. In development it prints a warning that it will use `127.0.0.1` as the
visitor's address. That's expected on localhost.

### `src/middleware/security.js`

Turns an Arcjet client into Express middleware.

**`arcjetProtect(client, props)`** returns a middleware function. It's a function that makes
functions, so one piece of code can serve the base client now and stricter clients later (a login
route with a rate limit, for example).

- `client` is `null` in tests → it calls `next()` and does nothing
- It asks Arcjet: `await client.protect(req, props(req))`
- **Arcjet itself unreachable** (`isErrored`) → log a warning and let the request through. An outage
  at a security provider shouldn't take the whole site down. This is called failing open
- **Denied** → throw an `AppError`: `429` for a rate limit, `403` for a bot or a shield block
- Otherwise `next()`, and the request carries on

`securityMiddleware = arcjetProtect(aj)` is the base version every request passes through.

A local gotcha: Arcjet remembers a denial for about a minute, and on localhost every request comes
from `127.0.0.1`. One plain `curl` is classed as a bot, and then the browser is blocked too until
the minute is up. Send a browser user agent with `curl -A "Mozilla/5.0"` instead.

### `src/app.js`

Builds the Express app and puts the middleware in order. **Order is everything** in Express: each
request walks down this list from the top.

1. `helmet()` adds security headers to every response, such as one telling the browser not to
   guess file types and one stopping other sites framing the page
2. `securityMiddleware` (Arcjet) runs before the body is read, so a blocked request costs as little
   as possible
3. `express.json()` reads a JSON request body into `req.body`
4. `cookieParser()` reads cookies into `req.cookies`. Nothing uses it yet; the login session cookie
   arrives in phase 1
5. `app.use('/api/v1/health', healthRouter)`, and later, every other router
6. `notFound`, which is reached only when no router answered
7. `errorHandler`, which catches everything thrown above it

`app.js` exports the app **without** calling `listen`. That's what lets the tests use it.

### `src/server.js`

Imports the app and starts it listening on `PORT`, then prints `Server is running at
http://localhost:5600`. That's all it does, and keeping it separate from `app.js` is deliberate:
the tests import `app.js` and never open a real port.

## One request, traced

The card's request, `GET /api/v1/health`, when everything works:

1. `App.jsx` runs `fetch("/api/v1/health")`. The browser sends it to `localhost:5173`, which is
   Vite, because the address has no host of its own
2. Vite's proxy sees the path starts with `/api` and forwards it to `http://localhost:5600`
3. `helmet()` notes the headers to add to the response, then calls `next()`
4. `securityMiddleware` → `arcjetProtect` → `aj.protect(req)`. Arcjet allows a browser, so `next()`
5. `express.json()` finds no body on a `GET` and moves on; `cookieParser()` likewise
6. Express matches `/api/v1/health` to `healthRouter`, and its `'/'` handler runs
7. ``db.execute(sql`SELECT 1`)`` → Drizzle → the Neon driver → an HTTPS request to Neon → Postgres
   returns `1`
8. `res.json({ data: { status: 'ok', database: 'ok' } })` sends a 200
9. Vite hands the response back to the browser. `res.ok` is true, `.json()` parses the body,
   `body.data.database === "ok"`, and `setStatus("ok")` redraws the card in green

**Neon down.** Steps 1 to 6 are the same. At step 7 the request to Neon fails and `await` throws.
Express 5 passes the error to `errorHandler`. It isn't an `AppError` and has no `expose` flag, so
the details go to the server terminal, and the client gets `500 { error: { message: 'Something went
wrong' } }`. In the browser `res.ok` is false, `App.jsx` rejects the promise on purpose, `.catch`
runs, and the card shows **down** in amber.

**Express down.** Vite has nothing to forward to and answers `502 Bad Gateway` itself. Same path in
`App.jsx`: **down**. Both cases were checked in the browser on 2026-11-16.

## The tests

**Supertest** sends real HTTP requests to an Express app without the app listening on a port:
`request(app).get('/api/v1/health')`. It goes through every middleware exactly as a real request
would, which is why it needs `app.js` and not `server.js`.

**`tests/setup.js` runs before any test file**, because `vitest.config.js` lists it under
`setupFiles`. It loads `.env`, refuses to go on if `TEST_DB_URL` is missing, then sets `DB_URL` to
the test branch and `NODE_ENV` to `test`. Order is the reason it works: when a test file later
imports `app.js`, which imports `db/index.js` and `env.js`, those already read the test values.
dotenv inside them won't overwrite variables that are already set. `NODE_ENV=test` is also what
turns Arcjet off.

There are four tests in two files:

| File | Test | Proves |
| --- | --- | --- |
| `app.test.js` | AppError keeps its status and message | a 409 arrives as `{ error: { message } }` |
| `app.test.js` | an unexpected error becomes a generic 500 | the word `hunter2` in the thrown message never reaches the response |
| `app.test.js` | an unknown address gets a 404 | `notFound` runs and uses the same shape |
| `health.test.js` | health reports ok | the real app reaches the real Neon `test` branch |

The first two build a small app of their own (`makeTestApp`) with routes that fail on purpose,
because the real app has no route that throws yet. The 500 test silences `console.error` while it
runs, so the deliberate crash doesn't clutter the test output.

**Each test was seen to fail first.** The `app.test.js` tests were written before `app.js`,
`errors.js` and `errorHandler.js` existed, and the first run failed with *Cannot find module
'../src/app.js'*. They passed once the files were written.

The health test needed more than that. A test that passes could be passing for the wrong reason,
for example if it never reached Neon at all. So it was run once with `DB_URL` pointing at a Neon
address that doesn't exist. It failed with a 500. That failure is the proof the green run really
goes to the database.

## The frontend, file by file

### `frontend/vite.config.js`

Vite does two jobs. In development it's a server that sends your files to the browser and reloads
the page the moment you save. For production, `npm run build` bundles everything into a few small
files in `dist/`.

- `plugins: [react(), tailwindcss()]`: the React plugin understands JSX; the Tailwind plugin builds
  the CSS for whichever Tailwind classes your files use
- `proxy: { "/api": "http://localhost:5600" }`: a receptionist forwarding calls. The browser rings
  Vite, and Vite passes anything for `/api` to Express

The proxy solves a real problem. Browsers treat `localhost:5173` and `localhost:5600` as different
sites, and block a page from reading another site's responses unless that site sends CORS headers.
They also won't send one site's cookies to the other without extra setup. Going through the proxy,
the browser only ever sees one site, so neither problem arises, and the login cookie in phase 1 will
travel on every request by itself.

### `frontend/index.html`

The one HTML page the browser loads. It holds an empty `<div id="root">` and a script tag for
`/src/main.jsx`. React builds the whole page inside that div. `type="module"` allows the script to
use `import`.

### `frontend/src/main.jsx`

The starting point.
`createRoot(document.getElementById("root")).render(...)` finds the empty div and **mounts** the app
in it: React builds the HTML for `<App />` and puts it there.

The tags in angle brackets are **JSX**, HTML-like syntax inside JavaScript. Vite turns each tag into
a plain function call before the browser sees it.

Two wrappers sit around `<App />`:

- **`StrictMode`** checks for mistakes in development only. Among other things it runs every effect
  twice, to flush out effects that break when repeated. It does nothing in the production build
- **`BrowserRouter`** lets the app have several pages (`/quiz`, `/admin`) without full page
  reloads. Nothing uses it yet, but every page will sit inside it

### `frontend/src/App.jsx`

A **component** is a function that returns what to draw. `App` is the setup-check card.

- `const [status, setStatus] = useState("checking")`: `useState` is a value React remembers between
  draws. It starts as `"checking"`. Calling `setStatus("ok")` changes it, and React redraws the card
- `useEffect(() => { ... }, [])`: run this code after the first draw. The empty `[]` means "after the
  first draw only". Without it the code would run again after every redraw, and every `setStatus`
  causes a redraw. Here that means one extra fetch before it settles, because React skips the redraw
  when `setStatus` sets the value it already has. An effect that sets a *new* value each time would
  loop forever
- The `fetch` is a **promise chain**. Each `.then` runs when the step before finishes:
  1. If the response isn't OK (`res.ok` false for any 4xx or 5xx), reject on purpose with
     `Promise.reject(new Error("HTTP 500"))`, otherwise parse the JSON
  2. Read `body.data.database` and set `"ok"` or `"down"`
  3. `.catch` catches anything that went wrong at any step, including a network failure, and sets
     `"down"`
- The Tailwind classes describe the look in place: `flex items-center justify-center` centres the
  card, `bg-slate-950` is the near-black background, and the status colour is picked with a ternary,
  `text-emerald-400` for ok and `text-amber-400` otherwise

In development the browser's network tab shows the health request **twice**. That's StrictMode
running the effect twice, as described above.

### `frontend/src/App.css`

One line: `@import "tailwindcss";`. Tailwind v4 has no config file. The Vite plugin scans the
project and generates only the classes that are actually used, so the CSS file stays small (6 kB
here). Design tokens (colours, fonts) will go in this file, with `@theme`, once the look is chosen
in phase 3.

## Check yourself

<details>
<summary>1. What would happen if <code>express.json()</code> were moved below the routers?</summary>

Every route would get `req.body` as `undefined`, because the request reaches the route before
anything has read the JSON body. Express runs middleware in the order it's registered; anything
registered after a router never runs for that router's routes. `GET /health` wouldn't notice,
since it has no body, but a login form's `POST` would break.

</details>

<details>
<summary>2. Why are <code>app.js</code> and <code>server.js</code> two files?</summary>

So the tests can use the app without starting a server. Supertest needs the app object; it sends
requests into it directly. If `app.js` called `listen` itself, every test run would open port 5600,
and would clash with a dev server already running there.

</details>

<details>
<summary>3. A route throws <code>new Error("password=abc123")</code>. What does the browser see, and where does the message go?</summary>

The browser gets `500` and `{ error: { message: 'Something went wrong' } }`. It isn't an
`AppError`, so `errorHandler` takes the last branch: the full error, password included, goes to the
server terminal through `console.error`, and none of it goes into the response. The second test in
`app.test.js` proves exactly this with `hunter2`.

</details>

<details>
<summary>4. Arcjet's service goes down for an hour. Can players still use the site?</summary>

Yes. `arcjetProtect` sees `decision.isErrored()`, logs a warning and calls `next()`. The app fails
open: it loses the extra protection for that hour, but stays up. The other choice, failing closed,
would block every visitor because of someone else's outage.

</details>

<details>
<summary>5. Why can't <code>npm test</code> damage the data you see in the browser?</summary>

`tests/setup.js` runs before any test file and sets `DB_URL` to `TEST_DB_URL`, the Neon `test`
branch, and it stops the whole run if `TEST_DB_URL` is missing. When `db/index.js` is imported, the
database address is already the test branch. The browser uses the `dev` branch, which tests never
see.

</details>
