# System Architecture

**Status:** Phase 1 foundation. This document describes the target architecture and the
boundaries the Phase 1 scaffold already enforces. Items marked *(Phase N)* are not built
yet.

---

## 1. Context

Maara Merch is a multi-tenant retail management SaaS for clothing businesses. Three sales
channels — shop, van, online — will share one catalogue, customer base and financial
model, while stock is tracked per location.

Phase 1 delivers the admin application only. POS (Flutter), van sales (Flutter) and the
customer storefront (Next.js) are future products; the database and permission model are
designed so they can be added without reworking core entities.

```
                          ┌────────────────────────┐
                          │   Supabase Postgres    │
                          │  RLS · functions · RPC │
                          └───────────┬────────────┘
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
        │                             │                              │
┌───────┴────────┐          ┌─────────┴─────────┐          ┌─────────┴─────────┐
│ Admin (Next.js)│          │  POS (Flutter)    │          │ Storefront        │
│ Phase 1–7      │          │  future           │          │ (Next.js) future  │
└────────────────┘          └───────────────────┘          └───────────────────┘
```

The admin app is the only client with organization-management responsibilities. Future
clients consume the same schema through constrained APIs or RLS-scoped queries; they do
not receive the secret key.

## 2. Application architecture (admin)

```
apps/admin/src
├── app/(auth)/…                unauthenticated routes
├── app/(dashboard)/…           authenticated shell + pages
├── components/
│   ├── ui/                     shadcn primitives (owned, restyled)
│   ├── layout/                 sidebar, topbar, command menu, theme
│   ├── dashboard/              KPI, chart cards, activity feed
│   └── shared/                 DataTable, PageHeader, EmptyState, ConfirmDialog
├── features/<domain>/
│   ├── queries.ts              server-only reads (React cache where useful)
│   ├── actions.ts              "use server" mutations, Zod validated
│   ├── schema.ts               domain Zod schemas
│   └── components/             domain-specific UI
├── lib/
│   ├── supabase/               browser client, server client, admin client
│   ├── auth/                   session helpers, requireUser, requireOrg
│   ├── permissions/            permission keys + server checks
│   ├── security/               headers, redirect validation, rate limits
│   └── validation/             shared primitives (money, ids, pagination)
├── hooks/
├── types/
└── tests/
```

**Rendering rules**

- Server Components by default; `"use client"` only for interaction or browser APIs.
- Reads happen in server components/queries, never in client effects for first paint.
- Mutations are Server Actions (or Route Handlers for downloads/webhooks), validated
  with Zod on the server. Every mutation resolves the organization from the session and
  re-checks permission in the database.
- Client state is limited to UI concerns (Zustand for shell preferences, if needed).
  Server data is not mirrored into a global store.

**Request flow for a mutation**

1. Server Action receives `FormData` or a typed payload.
2. Zod schema validates shape and bounds.
3. `requireOrganization()` resolves the active organization from the verified session,
   never from a client-supplied id.
4. Permission check runs server-side (`has_permission(org, key)`).
5. Database function performs the atomic transaction (stock changes, receiving, refunds).
6. Audit entry is written by the database function.
7. `revalidatePath` / route refresh; the UI receives a typed result.
8. Errors are mapped to safe, user-facing messages; no SQL or internal detail leaks.

## 3. Multi-tenancy

- Every business record carries `organization_id uuid not null`.
- Membership is the only source of tenant access. A user may belong to multiple
  organizations; the active organization is held in a cookie **and re-validated**
  against `organization_members` on every request.
- Client-provided organization ids are ignored for authorization. RLS also enforces
  `organization_id = any(current_org_ids())` as defence in depth.
- Invitations are tokenized, hashed at rest, single-use, expiring, and bound to an email.
- Organization creation is an authenticated, rate-limited RPC that creates the
  organization, default locations, settings and the Owner membership in one transaction.

## 4. Data architecture

Core principles:

1. **Money is `bigint` paise.** No floating point, no numeric currency in JS arithmetic.
   Formatting only at presentation via `Intl.NumberFormat("en-IN")`.
2. **Percentages are basis points** (`int`, 10000 = 100%).
3. **Inventory is movement-first.** `inventory_movements` is append-only; balances are a
   derived current-state table updated only inside trusted database functions.
4. **Purchases do not move stock.** Only goods receipts increase stock. Returns and
   adjustments create explicit movements.
5. **Financial records are traceable.** Ledger rows reference their source (order,
   purchase, expense, payment, refund).
6. **Timestamps are `timestamptz` in UTC**, displayed in the organization timezone
   (default `Asia/Kolkata`).
7. **UUID primary keys**, `created_at`/`updated_at` everywhere, `updated_by` where useful.

Detailed table definitions: `docs/database/schema.md`.

## 5. Authentication and authorization

- Supabase Auth (email + password) with server-side session refresh via `@supabase/ssr`.
- Protected routes enforced in the proxy/middleware layer **and** in each server
  component/action (`requireUser`, `requireOrganization`).
- Role-based access through six system roles and a static permission catalogue stored in
  the database (`roles`, `permissions`, `role_permissions`), evaluated by a
  `security definer` helper in a private schema.
- RLS on every exposed table; policies combine tenant membership and permission checks.
- Objects in Storage are scoped by `org/<organization_id>/…` and checked by policy.
- Audit logs are written by triggers/functions; clients have no write path.

Details: `docs/security/authentication.md`, `docs/security/rls-policies.md`.

## 6. Integrations and background work

- Email: Supabase Auth templates for invitations and password reset in Phase 2;
  transactional email provider can be added without changing domain code.
- Exports: CSV generated server-side from the same query builder as the on-screen report,
  streamed from a Route Handler. PDF is deferred until CSV accuracy is proven.
- Notifications: derived from data (low stock, pending receiving) in Phase 4; persisted
  `notifications` rows only if per-user read state is required.
- Scheduled jobs (daily summary, low-stock digest) are Supabase `pg_cron` candidates,
  introduced only with a documented need.

## 7. Future client compatibility

- Inventory and sales operations are database functions with explicit contracts, so the
  future POS and van app can call the same functions through a thin API.
- Channel is an enum on orders (`shop`, `van`, `online`); van locations are ordinary
  locations with `type = 'van'`.
- Offline-first van sync is **not** designed in Phase 1 beyond immutable movement ids and
  idempotency keys on sale creation; the sync protocol is a later design exercise.
- The storefront will use a read-only catalogue projection and its own checkout flow;
  it does not get admin permissions.

## 8. Non-goals for Phase 1

- POS billing screens, receipt printing, cash drawers
- Van route planning, vehicle tracking, offline sync
- Customer storefront, payments, shipping
- Real-time dashboards (queries are request-time and revalidated)
- Analytics warehouse / BI export pipeline

## 9. Key decisions to confirm before Phase 4

| # | Decision | Working assumption |
| --- | --- | --- |
| D1 | `stores` vs `locations` boundary | `stores` = commercial storefront identity; `locations` = stock-holding places (shop, warehouse, van, online fulfilment) |
| D2 | Tax-inclusive vs exclusive pricing | Prices are tax-exclusive by default; invoice setting can switch display |
| D3 | Costing method | Moving weighted average, snapshotted onto sale lines |
| D4 | Negative stock | Forbidden; receiving and transfers validate availability inside the transaction |
| D5 | Approval flow | Receiving and stock adjustments require `inventory.approve` for Staff roles |
| D6 | Multi-currency | INR only in Phase 1; schema keeps a currency column on organizations |

Each decision is recorded in `docs/business-rules/` and must be resolved before the
related module ships.
