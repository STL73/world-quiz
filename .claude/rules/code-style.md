# Code Style

There's no Prettier config. Match the file you're in. The two packages differ:

| Convention | `frontend/` | `backend/` |
| --- | --- | --- |
| Quotes | double | single |
| Semicolons | yes | yes |
| Indent | 2 spaces | 4 spaces |
| Trailing commas | yes, multi-line | yes, multi-line |

## Shared conventions

- ES modules everywhere; no CommonJS
- `const` by default; arrow functions for callbacks, `function` declarations for components and
  top-level helpers
- Derive values instead of storing them in extra state
- Immutable updates: spread or `map`/`filter`, never mutate state or props
- No `console.log` left in frontend code. The backend's start-up log in `server.js` is fine
- Lint: ESLint flat config in each package (`eslint.config.js`)

## Comments

- **One line above each component and exported function** saying what it does, in plain words
- **A "why" only when the code can't show it**, at most two lines. Don't narrate what the code does
- **No history in code:** no phase numbers, no dates, no "used to", and no references to the PHP
  version. Decisions live in `.claude/rules/` and git
- **Tests are the exception for length:** a comment explaining how a test forces its situation may
  be as long as it needs

The full teaching for each file lives in `docs/learning/`, not in comments.

## JavaScript, not TypeScript

Plain JS/JSX. No `.ts` files or TS-only syntax. JSDoc only where a type genuinely helps a shared
helper.

## Commits

Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`). Never commit
without asking Slav first.
