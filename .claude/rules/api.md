# API Rules

## Routing

All routes are versioned under `/api/v1`, one router per resource, mounted in `src/app.js`:

| Mount | File and endpoints |
| --- | --- |
| `/api/v1/health` | `routes/health.routes.js`: `GET /` (API and database check) |
| `/api/v1/auth` | `routes/auth.routes.js`: `POST /sign-up`, `POST /login`, `POST /logout`, `GET /me` |
| `/api/v1/rounds` | `routes/rounds.routes.js`, players only: `POST /`, `GET /current`, `POST /current/hint`, `POST /current/answer`, `POST /current/abandon`, `GET /:id` |

- Router files: `const xRouter = Router();` then `export default xRouter;`
- REST verbs: `GET` list/detail, `POST` create, `PUT` update, `DELETE` remove. Actions that aren't
  CRUD are a sub-path verb (`/questions/:id/hint`)

## Middleware order

In `src/app.js`: `helmet()`, then `securityMiddleware` (Arcjet, before the body is parsed), then
`express.json()`, then `cookieParser()`, then the routers, then `notFound` and `errorHandler`, last.
Middleware registered after a router never runs for that router's routes.

## Responses and errors

```js
{ data: {...} }                                                  // one item
{ data: [...], pagination: { page, limit, total, totalPages } }  // a list
{ error: { message: 'Email already in use', details: [...] } }   // an error
```

- **No try/catch in routes.** Express 5 passes errors from async routes to `errorHandler`. Throw
  `new AppError(status, message, details?)` for anything the client should see; anything else
  becomes a 500 with a generic message, and the real error goes only to the server log
- **Security:** `config/arcjet.js` makes one Arcjet client (shield, bot detection allowing search
  engines and link previews). Stricter rules for a route use `aj.withRule()` at module level, run by
  `arcjetProtect(client, props)`. Rate limit = 429, bot or shield = 403, an email the sign-up rule
  refuses = 400 under `body.email`; if Arcjet can't be reached
  the request goes through. Tests skip Arcjet
- **Local testing gotcha:** Arcjet caches a denial for about a minute, and locally every request
  comes from 127.0.0.1. One plain `curl` (classed as a bot) makes every request 403 for that minute,
  browser included. Send a browser user agent with `curl -A`
- **Validation:** `validate({ body, query, params })` checks each part against a Zod schema in
  `src/validation/` onto `req.valid`; routes read only `req.valid`. A failure is a 400 whose
  `details` list every problem as `{ path: 'body.email', message }`. `fieldError(status, field,
  message)` makes a one-field error the same shape
- **Play routes** act on the player's one active round, so the browser never names a question. An
  answer is a button (`{ choice: 1-3 }`); the server maps it through the round's `answer_order`.
  A question must be opened with `GET /current` before it can be answered or hinted (409 if not)
- **Auth:** `requireAuth` (401) loads `req.user` from the `sid` cookie; `requireRole(...roles)`
  (403) runs after it. Sessions are 30 days, renewed with under 15 left, and new at every login

## Status codes

| Code | When |
| --- | --- |
| 200 | Read or action with a body |
| 201 | Something created |
| 204 | Done, nothing to send |
| 400 | Invalid input |
| 401 | Not logged in, or wrong email or password |
| 403 | Logged in but not allowed, or blocked by Arcjet |
| 404 | Not found |
| 409 | Clashes with what exists (email already in use) |
| 429 | Rate limited |
