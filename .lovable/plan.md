# Restaurante Lite — Dashboard

Build a single-page Dashboard that matches the mockup exactly, backed by Lovable Cloud (auth + Postgres). Other nav items (Upload, Inventory, Sales, Results) render as "Coming soon" placeholders so the nav still works.

## Design tokens (exact match)

Port the mockup's Tailwind config into `src/styles.css` as semantic tokens:
- Font: Inter (400/500/600/700) + Material Symbols Outlined (Google Fonts)
- Primary green `#0d631b`, secondary `#2a6b2c`, tertiary `#923357`, error `#ba1a1a`
- Surface stack: `surface #fbf9f8`, `surface-container #f0eded`, `surface-container-high #eae8e7`, `surface-container-highest #e4e2e1`
- Typography scale: `display-lg 48/56`, `headline-lg 32/40`, `title-md 20/28`, `body-lg 16/24`, `body-sm 14/20`, `numeric-data 18/24`, `label-caps 12/16 +0.05em`
- Spacing scale + 12-col bento grid with 24px gutter (16px on mobile)
- Border radius: `lg 0.25rem`, `xl 0.5rem`, `full 0.75rem`

All values go into `:root` as oklch (converted from the hex) and are exposed via `@theme inline` so they work as Tailwind utilities (`bg-primary`, `text-on-surface`, etc.).

## Pages & routes

```
src/routes/
  __root.tsx              shell (already exists)
  index.tsx               redirects to /dashboard
  _app.tsx                layout: top bar + bottom nav, <Outlet />
  _app.dashboard.tsx      Dashboard (the screen in the mockup)
  _app.upload.tsx         "Coming soon"
  _app.inventory.tsx      "Coming soon"
  _app.sales.tsx          "Coming soon"
  _app.results.tsx        "Coming soon"
  login.tsx               email/password sign-in + sign-up
```

Each route sets its own `head()` with title and description.

## Dashboard composition (matches mockup)

Bento grid (12 cols desktop, 1 col mobile):
1. **Financial Overview** (col-span-8) — Today's Net Profit `display-lg`, trend chip, Income / Expenses split, "Full Report" link.
2. **Critical Alerts** (col-span-4) — "3 ITEMS LOW" badge, list of low-stock items with REORDER buttons.
3. **Suggested Count Today** (col-span-8) — three item rows (Premium Gin / Ribeye Steak / Organic Eggs) with confidence badges and Material icons.
4. **Kitchen Health** (col-span-4) — big `94%` numeric, supporting copy.
5. **New Inventory Entry** CTA card + **Inventory Insights** tip card (col-span-6 each).

Top app bar: menu icon, "Restaurante Lite" brand, horizontal tabs (Dashboard / Upload / Inventory / Sales) as `<Link>`s with active styling.
Bottom nav (mobile): 5 Material Symbols icons matching the mockup.

## Backend (Lovable Cloud)

Tables (RLS enabled, user-scoped via `user_id = auth.uid()`):
- `inventory_items` — id, user_id, name, category, unit, current_stock, threshold, value_tier, rotation, expiring, updated_at
- `sales_entries` — id, user_id, amount, occurred_at
- `expense_entries` — id, user_id, amount, category, occurred_at

Server functions in `src/lib/dashboard.functions.ts` (all `requireSupabaseAuth`):
- `getDashboard()` — returns `{ todayIncome, todayExpenses, netProfit, trendPct, lowStock[], suggestedCounts[], kitchenHealthPct }` computed from the three tables.

Dashboard route: `beforeLoad` gates on `supabase.auth.getUser()`, `loader` calls `getDashboard()`. Empty state renders zeros + a "Seed sample data" button that inserts a handful of rows so the user sees the layout populated immediately.

## Auth

Email/password only (Google not requested). `/login` page with sign-in + sign-up tabs using the browser Supabase client. `_app` layout gates the subtree on session; unauthenticated users redirect to `/login`. `__root.tsx` wires `onAuthStateChange` to invalidate the router + React Query cache.

## Technical notes

- Tailwind v4 `@theme inline` in `src/styles.css` — convert each hex from the mockup to oklch, keep semantic names (`--primary`, `--on-primary`, `--surface-container`, etc.).
- Material Symbols loaded via `<link>` in `__root.tsx` head; `.material-symbols-outlined` global class in `styles.css` with the variation settings from the mockup.
- Bento grid is a small reusable component (`src/components/BentoGrid.tsx`).
- `attachSupabaseAuth` middleware appended in `src/start.ts` so the bearer token reaches `getDashboard()`.
- Out of scope this round: Upload/OCR flow, Inventory CRUD, Sales entry, Results analytics — their routes ship as placeholders and become follow-up work.