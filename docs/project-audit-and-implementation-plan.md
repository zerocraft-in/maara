# Project Audit and Implementation Plan

Last updated: 20 November 2026.

This document is the current engineering snapshot for the Maara Merch
workspace. It is an implementation plan and a risk register, not a claim that
the application is production-ready.

## 1. Current scope

The repository contains a Next.js 16 admin application with React 19,
TypeScript, Tailwind, Supabase Auth/Postgres/Storage, server actions, route
handlers, product and media workflows, settings, locations, users, audit logs,
and the shared Shopify-style dashboard shell.

The current worktree also contains active UI refactors. Treat the worktree as
the source of truth until the changes are committed and CI is added.

## 2. Appearance feature removal

The Settings Appearance feature has been removed.

Removed:

- `apps/admin/src/app/(dashboard)/settings/appearance/page.tsx`
- Appearance-specific state for theme mode, accent colors, radius, density,
  font scale, motion, contrast, and compact sidebar settings.
- The browser `user_settings` upsert/fallback persistence used only by that
  screen.
- The `maara:appearance` local-storage fallback.

Repository verification found no Appearance migration, server action, API route,
or backend table reference remaining. The application-level light/dark token
and notification theme infrastructure is intentionally retained because it is
shared UI infrastructure, not the removed Settings feature.

## 3. Repository inventory

| Area | Current state | Next action |
| --- | --- | --- |
| App shell and route protection | Implemented, needs route-matcher hardening | Add complete protected-route matcher tests |
| Settings | General settings are canonical at `/settings`; legacy `/settings/general` redirects | Keep links and revalidation paths canonical |
| Products | Create/edit/media/variants flows present | Add end-to-end coverage and server input contract tests |
| Media | R2-backed API and database metadata present | Verify private/public URL policy and cleanup jobs |
| Locations | CRUD flow present | Add concurrency and authorization tests |
| Users and invitations | Present in app and server actions | Verify privilege boundaries against a running database |
| Audit logs | Read-only UI and database design present | Prove trigger/RPC coverage and retention policy |
| Supabase migrations/RLS | Migrations and policy documentation present | Run local Supabase and pgTAP/RLS suite |
| CI/CD | Not established | Add typecheck, lint, unit, security, and build gates |

## 4. Audit findings

Severity uses `Critical`, `High`, `Medium`, and `Low`. Findings are based on
static repository inspection and the local browser; database-backed claims are
unverified until Supabase runs locally.

### Critical — tenancy and RLS are not proven

The repository contains RLS design and migrations, but Docker is unavailable on
the current machine. Cross-tenant reads, writes, storage policies, and
privileged RPC behavior have not been executed against a real database.

Required protection:

1. Start local Supabase.
2. Reset from an empty database.
3. Run the RLS, RBAC, concurrency, and invitation suites.
4. Add cross-organization negative tests to CI.

### High — test product route should not ship

`apps/admin/src/app/api/test-create-product/route.ts` exposes a test-named POST
route and returns `String(error)` to the caller. The underlying action checks a
permission, but the route is still an unnecessary production surface and can
leak internal error text.

Plan: delete the route, or gate it behind an explicit development-only check and
return a safe error envelope. The preferred action is deletion because the
product server action already exists.

### High — proxy matcher coverage is incomplete

`apps/admin/src/proxy.ts` currently matches only a small set of dashboard and
auth paths. Pages and actions perform their own authorization, which is the
correct boundary, but the proxy does not provide consistent early redirects for
all protected routes.

Plan: expand matcher coverage to the protected application surface while
retaining page/action/server authorization as the source of truth. Add tests for
direct navigation to every protected module.

### Medium — client-supplied organization filters

The products API accepts `organization_id` as a query parameter. The endpoint
also checks permission and Supabase RLS, but authorization should derive the
active organization from the authenticated session rather than trust a client
filter.

Plan: remove the parameter, resolve the active organization server-side, and
keep the organization predicate only as an internal query constraint.

### Medium — media URL policy needs one authoritative decision

The media route documentation describes private buckets and signed access, while
the R2 route comments describe a public media URL. These statements conflict.

Plan: choose private-by-default signed URLs, update route comments and docs,
then add an authorization test for every read and download path.

### Medium — generated Next.js cache can retain deleted routes

`.next/types` can reference routes that were moved or removed. This is generated
cache, not source, but it can make TypeScript fail with stale route validator
errors.

Plan: clean `apps/admin/.next` after route moves and regenerate it with the
development server or production build. Never commit `.next`.

### Medium — repeated server queries and large client surfaces

Several pages load organization context and related records independently, and
some data-heavy screens assemble related product/media rows in multiple queries.

Plan: profile the slowest routes, add bounded pagination, select only fields
needed by each view, and cache only immutable or safely scoped reads.

### Low — dead and transitional code

The settings route move has left compatibility files and a number of active
worktree changes. Keep compatibility redirects where external links may exist,
but remove dead implementations after the route migration is stable.

## 5. Security protection baseline

These controls are required before production:

- Server-side `getUser()` and active-membership checks on every protected page,
  Server Action, and Route Handler.
- Permission checks at the action/API boundary; UI visibility is not security.
- RLS enabled on every exposed organization-owned table.
- No client-provided organization ID used as the authorization source.
- Service/secret keys restricted to server-only modules and never logged.
- Private storage buckets, server-generated object keys, MIME/extension/size
  validation, and short-lived signed URLs.
- Zod validation with unknown-field rejection for mutation inputs.
- Safe public errors; no SQL, stack traces, or raw internal error strings.
- Rate limits for auth, invitation, upload, export, and expensive list routes.
- CSP, HSTS, frame protection, referrer policy, and content-type protection.
- Audit records for membership, permission, inventory, finance, media, and
  authentication events.
- Dependency audit and lockfile review before every release.

## 6. Performance, cache, and reliability plan

1. Add route-level loading and error boundaries to every dashboard module.
2. Use server pagination for products, media, users, and audit logs.
3. Avoid N+1 related-record queries; use bounded joins or batch queries.
4. Add request cancellation for client fetches and media picker searches.
5. Debounce search and filter requests; keep cursor pagination stable.
6. Cache only organization-scoped, non-sensitive reads with explicit invalidation.
7. Revalidate affected paths after mutations; never use a global cache purge for
   a tenant-scoped change.
8. Track Web Vitals and server timings before optimizing by guesswork.
9. Remove `.next`, test reports, and local build artifacts when debugging stale
   route or bundle behavior.

## 7. Implementation plan

### Phase A — workspace cleanup and route stabilization

- [x] Remove the Settings Appearance route and persistence code.
- [x] Make `/settings` the canonical General settings route.
- [x] Keep `/settings/general` as a compatibility redirect.
- [ ] Remove stale `.next` output and regenerate route types.
- [ ] Remove the test product API route.
- [ ] Update all route links and revalidation paths to canonical settings URLs.

Exit criteria: no Appearance references remain, `/settings` loads General, the
legacy route redirects, and typecheck passes from a clean `.next` directory.

### Phase B — security boundary hardening

- [ ] Expand and test the proxy matcher.
- [ ] Remove client-controlled organization filters from APIs.
- [ ] Replace raw error responses with safe stable error codes.
- [ ] Decide and enforce private media URL behavior.
- [ ] Run Supabase migrations from empty state.
- [ ] Run RLS, RBAC, invitation, storage, and concurrency tests.

Exit criteria: cross-tenant access tests fail closed and no production route
exposes raw internal errors.

### Phase C — API and data contracts

- [ ] Define typed request/response schemas for every route handler.
- [ ] Centralize active-organization resolution.
- [ ] Add idempotency keys to inventory, sales, receiving, and file registration.
- [ ] Document status transitions and domain error codes.
- [ ] Add contract tests for products, media, users, and settings.

Exit criteria: every mutation has a validated input contract and an authorization
test.

### Phase D — reliability and performance

- [ ] Add loading/error/empty states to all modules.
- [ ] Profile server queries and fix N+1 access patterns.
- [ ] Add pagination and request cancellation to large lists.
- [ ] Add retry/backoff only for safe idempotent operations.
- [ ] Add structured logging with request IDs and organization-safe context.

Exit criteria: performance budgets are measured at 390, 768, 1024, and 1440 px
and the critical flows have no unbounded list or request behavior.

### Phase E — product protections and recommended features

- [ ] Organization activity feed and security event notifications.
- [ ] Backup/export and retention controls.
- [ ] Two-factor authentication and session/device management.
- [ ] Role editor with privilege-escalation prevention UX.
- [ ] Bulk product import with dry-run validation and idempotency.
- [ ] Inventory adjustment approval workflow.
- [ ] Feature flags for unfinished modules and safe rollout.
- [ ] Observability dashboard for errors, latency, auth failures, and storage.

Exit criteria: recommended features are separately permissioned, audited, and
can be disabled without taking down core sales or inventory flows.

## 8. Verification commands

Run from `D:\projects\maara`:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm exec supabase db reset
```

The Supabase command requires Docker Desktop. Until it runs successfully, the
security status remains unverified.

## 9. Definition of done

A feature is complete only when its UI, server actions/API, database migration,
RLS policy, audit behavior, loading/error states, tests, documentation, and
rollback or removal path are all present. A green TypeScript build alone is not
security verification.
