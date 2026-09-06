# Deployment Rules

**No production deployment exists yet.** WorldQuiz currently runs locally via XAMPP at `localhost/WorldQuiz/`.

When the project is deployed, this file should cover:

- The hosting target (shared PHP host, VPS, container platform).
- How `src/includes/wq_db_connect.php` reads credentials — today they are hardcoded (`localhost`, `root`, empty password, `wq_db`). Any real deploy must move these to environment variables or a non-committed config file.
- How the database schema and seed data (`database/seed.sql`) are applied.
- How the `Images/` folder is shipped — it is part of the repo today but may need a separate asset pipeline in production.
- HTTPS, session cookie flags (`Secure`, `HttpOnly`, `SameSite`), and any production-specific PHP ini settings.
- A rollback procedure.

Until then, the only deployment step is copying the repo into the web-server document root locally.
