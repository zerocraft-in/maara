# Maara Merch

Multi-tenant retail management SaaS for clothing businesses — products, stock,
purchasing, sales, expenses and finance in one admin application.

**Current status: Phase 1 (foundation) only.** The repository contains a buildable
Next.js 16 application with the approved Maara design tokens, owned shadcn/ui
primitives, a tested money module and the full architecture, database, security
and business-rule documentation. Authentication, the dashboard shell and all 16
business modules are **not implemented yet**. The app currently renders a
foundation status page.

---

## Repository layout

```text
maara-merch/
├── apps/
│   └── admin/                 Next.js 16 admin application
│       ├── src/app/           App Router (one page in Phase 1)
│       ├── src/components/    ui, layout, providers
│       ├── src/lib/           money, utils, future supabase/auth/permissions
│       ├── src/lib/money.test.ts
│       ├── e2e/               Playwright tests (browsers not installed yet)
│       └── public/
├── packages/                  reserved for contracts and shared types (empty)
├── supabase/
│   ├── config.toml            local stack configuration
│   └── seed.sql               intentionally empty
├── docs/
│   ├── architecture/          prototype inspection, mapping, system design
│   ├── database/              schema and relationships
│   ├── security/              RLS and authentication plans
│   ├── business-rules/        inventory, purchases, sales, finance
│   ├── api/                   API contracts (planned)
│   ├── development/           local setup and phased plan
│   └── deployment/            Vercel + Supabase runbook (not executed)
├── .env.example
├── package.json               workspace scripts
├── pnpm-workspace.yaml
└── SECURITY.md
```

The reference HTML/CSS prototype lives at `D:\projects\maara` and is **read-only**.
It is the visual source of truth and was not modified.

## Stack

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS 4 ·
shadcn/ui (owned components) · Lucide · Manrope · React Hook Form · Zod ·
TanStack Table v8 · Recharts v2 · date-fns · Sonner · Supabase (Postgres, Auth,
Storage) · `@supabase/ssr` · pnpm 10 · Vitest · Playwright.

Exact versions are pinned in `apps/admin/package.json` and the lockfile.

## Quick start

```powershell
$env:PATH = "$env:APPDATA\npm;" + $env:PATH   # Windows: pnpm is installed via npm
pnpm install
pnpm dev                                     # http://localhost:3000
```

Checks:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Database (requires Docker Desktop, which is not installed on this machine):

```powershell
pnpm exec supabase start
pnpm db:reset
```

See `docs/development/local-setup.md` for environment variables, ports and the
Windows pnpm caveat.

## What is implemented

| Area | State |
| --- | --- |
| Monorepo + pinned dependencies | done |
| TypeScript strict, ESLint, production build | done |
| Maara light/dark tokens, Manrope, theme provider | done |
| Base UI primitives (button, card, badge, separator, skeleton, sonner) | done |
| Integer-paise money module + 19 unit tests | done |
| Foundation status page, responsive and themed | done |
| Auth, tenancy, RLS, migrations | designed, not implemented |
| Dashboard shell and 16 modules | documented, not implemented |
| Supabase local stack | blocked (Docker unavailable) |

Every "not implemented" item is labelled as such in the UI and docs. No button
pretends to save data, and there is no hardcoded demo dataset outside seed files.

## Product scope

Phase 1 covers the admin application only. The future Maara POS (Flutter), Maara
Van Sales (offline-first) and Maara Storefront (Next.js) are not part of this
phase, but the schema, channel model, RPC boundaries and idempotency rules are
designed so they can share the same backend.

Key rules that will not be relaxed:

- Money is integer paise; no floating-point currency.
- Inventory is movement-first and immutable; balances are derived.
- Purchase orders never move stock — only confirmed goods receipts do.
- Every organization-owned row is protected by RLS and server-side permission
  checks.
- No production secrets in the repository, no production database change without
  approval.

## Documentation

| Document | Purpose |
| --- | --- |
| `docs/architecture/prototype-inspection.md` | what the reference prototype contains |
| `docs/architecture/prototype-mapping.md` | prototype → route/component mapping |
| `docs/architecture/system-architecture.md` | layering, tenancy, decisions |
| `docs/database/schema.md` | normalized schema contract |
| `docs/database/relationships.md` | ER diagrams |
| `docs/security/rls-policies.md` | policy matrix, helper functions, tests |
| `docs/security/authentication.md` | auth, sessions, invitations |
| `docs/business-rules/*.md` | inventory, purchases, sales, finance |
| `docs/api/api-reference.md` | current (empty) and planned API |
| `docs/development/implementation-plan.md` | phases, status, risks |
| `docs/deployment/vercel-supabase.md` | deployment runbook (not executed) |

## Known blockers

1. **Docker Desktop is not installed.** The local Supabase stack cannot start, so
   no migration, RLS policy or auth flow has been executed or tested.
2. **Windows Application Control blocks native pnpm.** Use the npm-installed
   pnpm 10 through `%APPDATA%\npm` (see local setup).
3. **Hosted environments do not exist.** No Vercel project, Supabase hosted
   project, domain or CI pipeline has been created.

Nothing in this repository should be treated as production-ready until Phase 7
is complete and the security suite has run against a real database.

## Licence

Proprietary. All rights reserved.
