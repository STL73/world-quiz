# Deployment Rules

No production deployment exists yet. The project runs locally (`npm run dev` in each package).

Planned (spec, phase 5): Railway runs the Express API, which also serves the built React app from
`frontend/dist`, so the site has one origin. Neon `main` is the production database.

When it's deployed, document here:

- The Railway service, its build and start commands, and how to roll back
- Every production environment variable and where it is set
- How migrations run against the production database
- Cookie flags in production (`Secure`, `HttpOnly`, `SameSite`)
