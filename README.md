# MAB PMS — Frontend

React + TypeScript + Vite + Tailwind CSS web app for the MAB Production Management System.
Separate repository from the backend (`../backend`). Deployment target: Vercel (this folder is the project root).

**Status:** M4 — sign-in, session handling, responsive layout, dashboard and the Master Data section (`/master-data/:entity`). Later modules are listed in the navigation as clearly labelled "Not available yet" pages until their milestones (M5–M11).

## Structure

| Path              | Purpose                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `src/App.tsx`     | Routes: `/login`, `/` (dashboard), `/modules/:moduleKey` (planned-module pages), not found       |
| `src/auth/`       | `AuthProvider` (session check, sign-in, sign-out, expiry handling) and `RequireAuth` route guard |
| `src/api.ts`      | API client: `credentials: 'include'`, CSRF header on writes, typed errors                        |
| `src/components/` | `AppLayout` (sidebar, mobile drawer, header), `ApiStatus`, loaders                               |
| `src/pages/`      | Login, dashboard, master data (`pages/masterData/`), planned-module and not-found pages          |
| `src/contracts/`  | Mirrors of the backend response schemas                                                          |

The session is an HttpOnly cookie set by the backend; the app never stores tokens or passwords in `localStorage`, `sessionStorage` or readable cookies. The route guard only improves the experience: the backend enforces authentication on every protected API route.

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

The app runs at `http://127.0.0.1:5173` and calls the backend at `VITE_API_BASE_URL` (default `http://127.0.0.1:4000`). The frontend origin must be listed in the backend's `CORS_ALLOWED_ORIGINS`. Use `127.0.0.1` for both (not `localhost` for one and `127.0.0.1` for the other) so the session cookie is same-site.

To sign in locally, start the backend with `npm run dev:memory` (in `../backend`) and use one of the demo accounts it prints.

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

`src/contracts/` mirrors the backend's health, auth, error and dashboard schemas (backend `src/contracts/api.ts`). The repositories are independent, so the schemas are duplicated rather than imported; update them when the backend contract changes.

## Deployment (prepared, not deployed)

`vercel.json` builds with `npm ci` and `npm run build` from this folder and serves `dist/` with SPA rewrites and basic security headers. Vercel Hobby plan terms (personal, non-commercial use) must be checked before organisational use. For sign-in to work reliably, the frontend and API should be on the same site (custom domains, or a Vercel rewrite of `/api` to the backend); see the backend's `docs/m3-auth-dashboard.md` §5.
