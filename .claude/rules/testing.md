# Testing Rules

## Backend

- **Vitest + Supertest**, `npm test` (once) or `npm run test:watch`, from `backend/`
- Files: `backend/tests/*.test.js`. Supertest sends requests to `src/app.js` directly, with no
  port, which is why `server.js` only calls `listen`
- **Database:** the Neon branch `test` (`TEST_DB_URL`). `tests/setup.js` runs first, points
  `DB_URL` at it and refuses to run without it, so tests never touch the development database
- Arcjet is off in tests (`NODE_ENV=test`)
- Test first: write the test, watch it fail, then write the code
- Each phase adds tests for its endpoints. Outside services (Cloudinary) are never called; tests
  replace them with `vi.mock`

## Frontend

No test runner. Each frontend phase is checked in the browser, and the check is described in the
phase's plan.
