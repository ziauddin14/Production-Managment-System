# MAB PMS — Frontend

React + TypeScript + Vite + Tailwind CSS web app for the MAB Production Management System.
Separate repository from the backend (`../backend`). Deployment target: Vercel (this folder is the project root).

**Status:** M2 — placeholder shell that shows the backend API status. Application screens start in M3.

> **No secrets here.** Everything prefixed `VITE_` is bundled into public browser code. Database credentials and all other backend secrets stay in the backend's server-side configuration.

## Setup and run

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

The app runs at `http://127.0.0.1:5173` and calls the backend at `VITE_API_BASE_URL` (default `http://127.0.0.1:4000`). The frontend origin must be listed in the backend's `CORS_ALLOWED_ORIGINS`.

## Configuration

| Variable            | Required   | Default                 | Notes                                                                                  |
| ------------------- | ---------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | production | `http://127.0.0.1:4000` | Public base URL of the backend API, no trailing slash. Set in Vercel project settings. |

## Checks

| Command                | What it does                               |
| ---------------------- | ------------------------------------------ |
| `npm run lint`         | ESLint                                     |
| `npm run typecheck`    | TypeScript check                           |
| `npm test`             | Component tests (jsdom; network mocked)    |
| `npm run build`        | Type check + production build into `dist/` |
| `npm run format:check` | Prettier check                             |
| `npm run check`        | Lint, typecheck, tests and build           |

## API contract

`src/contracts/health.ts` mirrors the backend's health response schema (backend `src/contracts/api.ts`). The repositories are independent, so the schema is duplicated rather than imported; update it when the backend contract changes.

## Deployment (prepared, not deployed)

`vercel.json` builds with `npm ci` and `npm run build` from this folder and serves `dist/` with SPA rewrites and basic security headers. Vercel Hobby plan terms (personal, non-commercial use) must be checked before organisational use.
