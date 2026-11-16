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
│   │   ├── env.js          re-exports env vars (PORT, NODE_ENV, ARCJET_KEY)
│   │   └── arcjet.js       the one Arcjet client
│   ├── db/index.js         exports `db` (Drizzle client)
│   ├── lib/errors.js       AppError
│   ├── middleware/         errorHandler (+ notFound), security (arcjetProtect, securityMiddleware)
│   └── routes/<name>.routes.js
└── tests/                  Vitest + Supertest; setup.js points DB_URL at TEST_DB_URL
```

## Config

- Read env vars through `src/config/env.js`. `db/index.js` reads `process.env.DB_URL` directly and
  throws if it's missing; that fail-fast check is intentional
- `.env` files are gitignored. Never commit one. `backend/.env.example` lists every variable

## Neon branches

`main` is production, `dev` is `DB_URL` locally, `test` is `TEST_DB_URL`.

## Commands

Run from `backend/`: `npm run dev` (nodemon), `npm start`, `npm test`, `npm run lint`.
