## Purpose

This file gives targeted, actionable pointers for an AI code agent to be productive in this Next.js dashboard project.

## Quick context
- Framework: Next.js (pages/ based app). See `package.json` scripts: `npm run dev` runs `next dev -p 6005`.
- Language/runtime: Node.js + React (no TypeScript in repo). RTL/Arabic UI (see `pages/_document.js` dir="rtl").
- Key client files: `pages/index.js`, `pages/_app.js`, `pages/_document.js`, `styles/dashboard.css`, `public/images/`.
- Server helpers & DB: `lib/db.js` exports a cached `pg` Pool (uses `process.env.DATABASE_URL`).
- Client-side orchestration: `src/filters/GlobalFilterManager.js` (singleton pattern) and components in `src/components/`.

## High-level architecture & data flow
- The UI (pages/index.js) is largely rendered client-side and loads several browser libraries with `next/script` (Chart.js, Leaflet, XLSX). It also references `/js/app.js` for app-specific DOM logic.
- Data is expected to come from server-side API routes under `pages/api/` or external APIs (the file `api/sheets.js` is not present — search `pages/api` for endpoints before creating new routes).
- `lib/db.js` shows database access is centralized via a pooled `pg` connection. Serverless-friendly caching via `global.__pgPool` is required to avoid connection exhaustion; reuse this pattern for any new API route or server-side code.

## Project-specific conventions (do these exactly)
- Filter subscription: components subscribe to the global filter manager instance via `filterManager.subscribe(this)` and implement `onFilterUpdate(filters)` to receive updates. Example: `src/filters/GlobalFilterManager.js` + `src/components/FilterBar.js`.
- Database pool: always `import pool from '../../lib/db'` in API routes and reuse the exported `pool` object (do not create a new Pool instance in each request).
- Client libraries: large UI libs (Chart.js, Leaflet, XLSX) are loaded via CDN in `pages/_app.js` or `pages/index.js`. If adding chart/map code, rely on those globals (e.g., `window.Chart`, `L`) or use `next/script` with `strategy="beforeInteractive"` to ensure availability.
- Assets: static images live in `public/images/`. Reference them with absolute paths like `/images/logo.png`.

## Common tasks & commands
- Run dev server (Port 6005):

  npm install
  npm run dev

- Build and start production:

  npm run build
  npm run start

- Environment variables to check before running server: `DATABASE_URL` (Postgres), any Google API credentials if `googleapis` is used.

## Integration points & external deps to be aware of
- `googleapis` appears in `package.json` — search for server-side code that uses Google Sheets or Drive (likely in API routes). If credentials or OAuth flows are needed, prefer adding them to server-side API routes, not client code.
- `xlsx` is included and may be used either client-side (via CDN also referenced) or server-side to generate spreadsheets.
- `pg` + `lib/db.js` for Postgres access — keep connection pooling pattern.

## Where to look first when making changes
- UI behavior and filters: `src/filters/GlobalFilterManager.js` and `src/components/FilterBar.js`.
- Page shell & third-party scripts: `pages/_app.js`, `pages/_document.js`, and `pages/index.js`.
- DB and server logic: `lib/db.js` and `pages/api/` (create new routes here). If an expected API file is missing (e.g., `api/sheets.js`), grep the repo for references to `/api/sheets` before adding one.
- Styling: `styles/dashboard.css` — large single stylesheet; prefer small, additive CSS changes rather than wholesale rewrites.

## Small examples (copyable patterns)
- Reuse DB pool in API route (server-side):

  import pool from '../../lib/db'
  export default async function handler(req, res) {
    const { rows } = await pool.query('SELECT 1');
    res.json(rows);
  }

- Subscribe to filters in a new component:

  import { filterManager } from '../filters/GlobalFilterManager'
  class MyWidget {
    constructor(){ filterManager.subscribe(this) }
    onFilterUpdate(filters){ /* update chart/data */ }
  }

## Safety checks and non-obvious pitfalls
- Many client features rely on `window` globals provided by CDN scripts. Use `next/script` with appropriate `strategy` or guard `if (typeof window !== 'undefined')` before using them.
- The project expects a single Postgres connection pool per process (see `lib/db.js`). Creating Pools per-request will break under serverless.
- Some source files referenced from pages (e.g., `js/app.js`, `pages/api/sheets.js`) may be missing. Always grep for references before adding or deleting files.

## If you edit tests or add features
- There are no test files in the repo — keep changes small and manually verify UI interactions in dev mode.

## Contact / next steps
- If a requested behavior needs credentials (Google Sheets, DB), add a short TODO in the code and request the required env vars via the PR description.

---
If anything in these notes is unclear or you want more examples (API route templates, filter wiring, or Chart/Leaflet usage), tell me which area to expand.
