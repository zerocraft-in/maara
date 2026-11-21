# Maara Merch — Project Context

**Repository:** `D:\projects\maara`\
**Git remote:** `https://github.com/zerocraft-in/maara.git`\
**Primary branch:** `main`\
**Working tree:** clean (all changes committed and pushed)

---

## Project purpose

Maara Merch is a clothing-store management and POS system. It is **not primarily an e-commerce storefront**.

Goal: a complete store operations platform with a unified data model, including:

- Dashboard and business overview
- Products and product variants
- Inventory and stock by store/location
- POS / sales / billing
- Customers
- Purchases and suppliers
- Expenses
- Profit and business analytics
- Reports
- Organization, users, roles and permissions
- Multiple stores / branches (Locations)
- Audit logs
- Settings

The admin app is built with **Next.js 16**, **React**, **TypeScript**, **Tailwind CSS 4**, and **shadcn/ui**, with **hosted Supabase** (Postgres, Auth, RLS) as the backend.

---

## Technology and local environment

| Item | Value |
| --- | --- |
| Package manager | `pnpm` (pinned at v10.18.3) |
| Admin app | `@maara/admin` in `apps/admin/` |
| Frontend | Next.js 16.4.6, React 19, TypeScript, Turbopack |
| Backend | hosted Supabase (Postgres, Auth, RLS, RPCs) |
| Local dev command | `cd D:\projects\maara && pnpm dev` |
| Local app | `http://localhost:3000` |

Validation commands:

```powershell
pnpm --filter @maara/admin typecheck
pnpm --filter @maara/admin lint
pnpm --filter @maara/admin test
pnpm --filter @maara/admin build
git diff --check
```

---

## Module status

| Module | Status | Notes |
| --- | --- | --- |
| Project foundation | Done | Next.js 16, Tailwind 4, shadcn/ui, theme, lint, typecheck, build |
| Audit Logs | Done | Server page, TanStack Table, pagination, Owner/Admin only |
| Settings | Done | Organization settings, timezone, GSTIN, invoice prefix |
| Locations | Done | CRUD, user assignment, address fix applied |
| Sidebar / shell | Done | Settings header with slide-up "Settings → Back" text |
| Button component | Done | `asChild` support added; slide-up variant available |
| Authentication (Phase 2) | Planned | Login, logout, invites, onboarding — not yet built |
| Core business modules (Phase 4) | Planned | Products, inventory, purchases, sales, finance |

---

## Safety rules

- **Never commit, push, or deploy unless explicitly asked.**
- **Never touch production Supabase (`qvjhwxriafgobxknpqtq`) without explicit authorization.**
- **Never run `supabase db push` or local Supabase/Docker.**
- **Never print or request `.env.local`, API keys, service-role keys, or secrets.**
- **Make the smallest safe change; verify with typecheck/lint/build before committing.**
- **Inspect actual files and git state before making assumptions.**

---

## Key files

| Area | Path |
| --- | --- |
| UI button | `apps/admin/src/components/ui/button.tsx` |
| Slide-up button | `apps/admin/src/components/ui/button-slide-up.tsx` |
| Global styles | `apps/admin/src/app/globals.css` |
| Audit logs page | `apps/admin/src/app/(dashboard)/audit-logs/page.tsx` |
| Settings sidebar | `apps/admin/src/components/layout/sidebar/settings-sidebar.tsx` |
| Auth session helpers | `apps/admin/src/lib/auth/session.ts` |
| Supabase clients | `apps/admin/src/lib/supabase/` |
| Docs | `docs/` (architecture, database, security, business-rules) |

Archived historical reports: `docs/archive/` (Phase 2 migration/validation docs).
