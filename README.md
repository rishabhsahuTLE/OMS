# OMS — Order Management System

A single-page React + TypeScript app for managing customer accounts and orders (approvals, order list, billing). There is no backend and no router — all state lives in memory (`App.tsx`) and is seeded from static mock data, so a page refresh resets everything.

## Tech stack

- React 19 + TypeScript
- Vite 8 (dev server + build)
- Tailwind CSS v4 (utility classes only, no component library)
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
  App.tsx          # owns navigation state and top-level accounts/orders state
  types.ts         # domain model (Account, OrderRecord, ...)
  utils.ts         # order numbering, date formatting, mock "current user"
  data/            # deterministic mock accounts/orders
  components/      # shared UI (Sidebar, Modal, DateRangePicker, ...)
  pages/           # Dashboard, Report (Approval/Billing), Order Management (Account/Order/Closing Bill)
```

See `CLAUDE.md` for a deeper architecture walkthrough.
