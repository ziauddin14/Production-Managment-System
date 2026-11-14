# MAB PMS — Frontend

React + TypeScript + Vite + Tailwind CSS web app for the MAB Production Management System.
Separate repository from the backend (`../backend`). Deployment target: Vercel (this folder is the project root).

**Status:** M4–M11 built — sign-in, session handling, responsive layout, dashboard, master data, demands, purchase orders, receiving & stock (M7), dispatch / Bilty / delivery challan (M8), vendor payments (M9), Excel sync status (M10) and reports (M11). There are no "planned module" placeholder pages any more; old `/modules/:key` links redirect to the working module.

## Structure

| Path                        | Purpose                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`               | Routes (module pages are lazy-loaded); `/modules/:key` redirects old placeholder links                                                                                                                           |
| `src/navigation.ts`         | Sidebar modules and their paths                                                                                                                                                                                  |
| `src/auth/`                 | `AuthProvider` (session check, sign-in, sign-out, expiry handling) and `RequireAuth` guard                                                                                                                       |
| `src/api.ts`                | API client: `credentials: 'include'`, CSRF header on writes, typed errors, report CSV download                                                                                                                   |
| `src/hooks/useResource.ts`  | Shared loader for page data (abort on change, loading / error / not-found states)                                                                                                                                |
| `src/components/`           | `AppLayout`, shared UI (`ui.tsx`: badges, pagination, cancel-with-reason dialog, money format), list filters, PO picker, document-link editor                                                                    |
| `src/contracts/`            | Mirrors of the backend schemas; `operations.ts` mirrors the backend's M7–M11 contract                                                                                                                            |
| `src/pages/masterData/`     | Master data lists (`/master-data/:entity`)                                                                                                                                                                       |
| `src/pages/demands/`        | Demands list / form / detail, with delivered and remaining quantities and the demand's dispatches                                                                                                                |
| `src/pages/purchaseOrders/` | PO list (completion + payment badges), form, detail (received / remaining, paid / outstanding, the PO's receipts and payments)                                                                                   |
| `src/pages/receiving/`      | M7 `/receiving`: receipt list, new receipt from an open PO (`?purchaseOrderId=` prefill), detail with cancel                                                                                                     |
| `src/pages/stock/`          | M7 `/stock`: "Balances" (by warehouse / division and PO lot) and "Ledger" (signed movements) tabs                                                                                                                |
| `src/pages/dispatches/`     | M8 `/dispatches`: list, new dispatch (source stock lots, optional demand-line links, `?demandId=` prefill), detail with Bilty/transport editing and cancel, printable delivery challan `/dispatches/:id/challan` |
| `src/pages/payments/`       | M9 `/payments`: list, new payment from a PO (capped at the outstanding amount, optional planned instalment), detail with cancel                                                                                  |
| `src/pages/sync/`           | M10 `/sync`: Excel sync queue summary, processor note, jobs, retry for failed / conflicting jobs (operator)                                                                                                      |
| `src/pages/reports/`        | M11 `/reports`: report picker and filters, typed table with totals, CSV download and print                                                                                                                       |

Viewers (read-only role) see every page but no write buttons; the backend enforces roles and CSRF on every write regardless. Printing (delivery challan, reports) hides the sidebar and header.

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

`src/contracts/` mirrors the backend's health, auth, error, dashboard, master-data, demand and purchase-order schemas (backend `src/contracts/api.ts`) and the M7–M11 operations schemas (backend `src/contracts/operations.ts`). The repositories are independent, so the schemas are duplicated rather than imported; update them when the backend contract changes.

## Deployment (prepared, not deployed)

`vercel.json` builds with `npm ci` and `npm run build` from this folder and serves `dist/` with SPA rewrites and basic security headers. Vercel Hobby plan terms (personal, non-commercial use) must be checked before organisational use. For sign-in to work reliably, the frontend and API should be on the same site (custom domains, or a Vercel rewrite of `/api` to the backend); see the backend's `docs/m3-auth-dashboard.md` §5.
