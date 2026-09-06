# Frontend Rules

WorldQuiz's frontend is intentionally framework-free. These rules keep it that way.

## Stack constraints

- Vanilla ES6 JavaScript only. No React, Vue, Svelte, Alpine, jQuery, or any other framework.
- No build step. No bundler, no transpiler, no `package.json`. The browser runs the source files directly.
- All gameplay logic lives in `src/JS/app.js`. New JS goes in the same file unless it would push the file past ~600 lines, at which point split by feature (e.g. `app-quiz.js`, `app-admin.js`) and load each `<script>` separately.
- All styles live in `src/CSS/style.css`. Same rule for splitting if it grows past ~1000 lines.

## Design system

- **Theme:** Cinematic Dark + Editorial Glass. Dark background, glassmorphism cards, large editorial typography.
- **Fonts:** Playfair Display (headings) + Inter (body), loaded via Google Fonts.
- **Icons:** Boxicons via CDN (`<i class='bx bx-...'></i>`). No SVG icon libraries.
- Do not introduce a new font, icon set, or theme without explicit approval — the design is part of the project identity.

## JavaScript conventions

- Wrap all page-level logic in a single `document.addEventListener("DOMContentLoaded", ...)` handler.
- Use `const` by default, `let` only when reassignment is required, never `var`.
- camelCase for JS-native variables; snake_case is acceptable when mirroring keys from PHP JSON responses (e.g. `data.star_tokens`).
- Cache DOM lookups in `const` at the top of the handler rather than repeating `document.getElementById` in every function.
- Use `fetch` for AJAX. Always send the CSRF token from `<meta name="csrf-token">` in the `X-CSRF-Token` header for POST requests.
- Guard every DOM access with optional chaining or an existence check — the same `app.js` loads on pages that may not have every element.

## HTML structure

- Every page starts with `session_start()` and a session guard at the top of the PHP file.
- Every page that issues AJAX includes `<meta name="csrf-token" content="<?php echo csrf_token(); ?>">` in `<head>`.
- Stylesheet links use `?v=<?php echo @filemtime(...) ?>` for cache-busting on edits.
- Body-level data attributes (`data-user-id`, `data-saved-question`) are the bridge between PHP and JS — JS reads them on load instead of inlining `<script>` blocks with server-side values.

## Protected files

These files have intentional structure — do not refactor without discussion:

- `src/CSS/style.css` — design system, font order, custom property naming
- `src/JS/app.js` — gameplay loop wiring; reordering can break the AJAX sequence
- `src/index.php` — landing page layout and copy
