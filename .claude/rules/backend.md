# Backend Rules

## Stack constraints

- Node.js with **ES modules** (`"type": "module"`): always `import`/`export`, and always include the
  `.js` extension in relative imports (`./config/env.js`)
- Express 5
- PostgreSQL on **Neon**, accessed through **Drizzle ORM** (`drizzle-orm/neon-http`,
  `@neondatabase/serverless`). No raw SQL strings in route code; query through `db`
- `dotenv` for config, Zod for validation, Arcjet and `helmet` for security, bcryptjs for passwords,
  Cloudinary and multer for images. Each is installed in the phase that first uses it

## Layout

```text
backend/
├── src/
│   ├── app.js              the Express app: middleware, routers, error handling
│   ├── server.js           imports app and calls listen
│   ├── config/
│   │   ├── env.js          re-exports env vars (PORT, NODE_ENV, ARCJET_KEY, CLOUDINARY_*)
│   │   ├── arcjet.js       the one Arcjet client
│   │   └── cloudinary.js   the configured Cloudinary client, the photo folder and photo addresses
│   ├── db/index.js         exports `db` (Drizzle client)
│   ├── db/schema/          users.js (roleEnum, users, scores), quiz.js (countries, questions),
│   │                       auth.js (sessions), index.js
│   ├── db/seed.js          creates the admin from SEED_ADMIN_* (npm run db:seed)
│   ├── lib/                errors.js (AppError, fieldError, isUniqueViolation), passwords.js,
│   │                       tokens.js, sessions.js, accounts.js (publicUser, createPlayer)
│   ├── middleware/         errorHandler (+ notFound), security (arcjetProtect, securityMiddleware),
│   │                       validate, auth (requireAuth, requireRole)
│   ├── validation/         Zod schemas, one file per resource
│   └── routes/<name>.routes.js
├── scripts/                one-off scripts: importFromMysql.js and its transform.js
├── drizzle/                generated migrations + meta (commit these)
├── drizzle.config.js       points drizzle-kit at src/db/schema/index.js
└── tests/                  Vitest + Supertest; setup.js points DB_URL at TEST_DB_URL
```

## Config

- Read env vars through `src/config/env.js`. `db/index.js` reads `process.env.DB_URL` directly and
  throws if it's missing; that fail-fast check is intentional
- `.env` files are gitignored. Never commit one. `backend/.env.example` lists every variable

## Neon branches

`main` is production, `dev` is `DB_URL` locally, `test` is `TEST_DB_URL`.

## Commands

Run from `backend/`: `npm run dev` (nodemon), `npm start`, `npm test`, `npm run lint`,
`npm run db:seed` (the admin account), `npm run db:import` (the one-off MySQL import; XAMPP's MySQL
must be running).

## Schema conventions (Drizzle)

- Tables: `pgTable('<snake_plural>', ...)`, exported as camelCase (`users`)
- Columns: camelCase JS key, snake_case DB name: `userId: integer('user_id')`
- Primary keys: `integer('<table>_id').primaryKey().generatedAlwaysAsIdentity()`
- Enums: `pgEnum('<snake_name>', [...])`, exported as `<name>Enum`
- Every date column is `timestamp(..., { withTimezone: true })`
- Rules the data must always follow are CHECK and UNIQUE constraints in the schema, so they hold for
  the import and any future script too, not only for the routes
- A new schema file must be exported from `schema/index.js`, or drizzle-kit won't see it
- Writes to more than one table go in one `db.batch([...])`, which is one transaction on
  `neon-http` (the driver has no interactive transactions). A row needing an id made earlier in
  the same batch takes it from a parameterised subquery in `values()`; Drizzle's
  `insert().select()` only accepts a select listing every column of the table, in order

## Migrations

No npm scripts for drizzle-kit; run it with npx from `backend/`:

```bash
npx drizzle-kit generate --name <what_changed>   # schema -> SQL in drizzle/
npx drizzle-kit migrate                          # apply to the dev branch (DB_URL)
DB_TARGET=test npx drizzle-kit migrate           # apply to the test branch (TEST_DB_URL)
```

Show the generated SQL to Slav before applying it. Apply every migration to both branches. Never
edit a migration that has been applied; generate a new one.

## Cloudinary

Pass the folder as `folder`, apart from `public_id`: the account uses dynamic folders, where a
folder written only into the `public_id` leaves the photo at the root of the Media Library. The
`public_id` Cloudinary returns still starts with the folder. Photo addresses are built with
`urlAnalytics: false`, so they carry no `?_a=` SDK tag.
