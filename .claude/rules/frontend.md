# Frontend Rules

## Stack constraints

- React 19 with Vite 8, React Router 7, Tailwind CSS v4 through `@tailwindcss/vite`
- Plain JSX, no TypeScript
- Icons: lucide-react only
- No other UI or state libraries without Slav's approval

## Layout

```text
frontend/
├── index.html          page shell; React mounts into #root
├── vite.config.js      React + Tailwind plugins; /api proxied to the backend
└── src/
    ├── main.jsx        mounts <App /> inside StrictMode and BrowserRouter
    ├── App.jsx         setup-check page until the real pages arrive
    └── App.css         @import "tailwindcss"; design tokens go here
```

## Styling

- Tailwind v4 has no config file: design tokens are defined with `@theme` in `App.css`
- The visual direction is chosen in phase 3. Until then, no tokens and no shared classes

## Talking to the API

- Relative URLs only (`/api/v1/...`): Vite proxies them in development, and Express serves the app
  from the same origin in production
- Read `error.message` from failed responses; the API always uses `{ error: { message } }`

## Commands

Run from `frontend/`: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
