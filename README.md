# OMS — Order Management System

A single-page React + TypeScript app for managing customer/order data (dashboards, approvals, order list, billing). There is no backend — all state lives in memory (`App.tsx`) and is seeded from static mock data, so a page refresh resets everything. Navigation is still hash-based client-side routing (`react-router-dom`'s `HashRouter`), chosen so every tab gets a bookmarkable URL with zero extra server/host config.

## Tech stack

- React 19 + TypeScript
- Vite 8 (dev server + build)
- Tailwind CSS v4 (utility classes only, no component library)
- react-router-dom (HashRouter, client-side only)
- oxlint for linting

## Getting started

```bash
npm install
npm run dev
```

The dev server starts with hot module reloading. Open the printed local URL in your browser.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then build for production into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run oxlint |

There is no test runner configured in this project.

## Deploying to Vercel

This is a static Vite build with no server-side code, so it deploys as-is:

1. Push this repository to GitHub (or GitLab/Bitbucket).
2. In Vercel, click **Add New → Project** and import the repository.
3. Vercel auto-detects the Vite framework preset:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Click **Deploy**.

No environment variables are required — the app has no backend and uses static mock data.

## Project structure

```
src/
  main.tsx         # wraps <App /> in HashRouter
  App.tsx          # route map + top-level clients/orders state
  types.ts         # domain model (Client, OrderRecord, ...)
  products.ts      # per-product field definitions (LMS, Quirio)
  utils.ts         # order numbering, date formatting, mock "current user"
  data/            # deterministic mock clients/orders
  components/      # shared UI (Sidebar, Modal, DateRangePicker, ...)
  pages/           # Dashboard (role sub-dashboards), Report (Approval/Billing/Manager Report),
                    # Order Management (Manage Orders/Amend-Cancel/Close Billing)
```

See `CLAUDE.md` for a deeper architecture walkthrough.
