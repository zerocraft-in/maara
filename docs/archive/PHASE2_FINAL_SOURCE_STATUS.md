# Maara Merch — Phase 2 Final Source Status

## Overall Status: **GO — Safe for Local Database Validation**

All four migration SQL files have been corrected and verified. The repository is ready for isolated database validation. No remote changes have been made.

## Migration Status

| File | SHA256 | Status | Issues Fixed |
|---|---|---|---|
| `20261112175950_001_extensions_and_common_functions.sql` | `0b63123466020a8952b721210e921989d4cf1643f154de0c8733788301998913` | PASS | Removed invalid `comment on migration` |
| `20261112175953_002_organizations.sql` | `9a8f05bd615e25e801e5330f4bd7d5524da48aa1aa2ee3c309e3352c56cbbad3` | PASS | Removed invalid `comment on migration`; removed `organizations_insert_onboarding` policy (references `organization_members` from migration 003) |
| `20261112175958_003_profiles_memberships_roles_permissions.sql` | `5d1b4a7707b627c41710c99f7d6f4de38b0b996e2afce1a2bf1189abb76c0936` | PASS | Fixed `group` → `"group"`; fixed `change_member_role` variable collision; fixed `invite_member` lock ordering; removed `auth.users` references from migration 003 revoke; removed `comment on migration` |
| `20261112180002_004_invitations.sql` | `ca51c0a12feb44e1cc152a7278392324c3d23693a722904dd4899b1ca4695ed1` | PASS | Removed invalid `comment on migration` |

## Migration Dependency Order

```
001_extensions_and_common_functions.sql
  └─ Creates: pgcrypto, citext, private schema, 4 helper functions
  └── Depends on: Nothing

002_organizations.sql
  ├─ Creates: organizations table with RLS policies
  ├─ Depends on: Migration 001 (private.current_org_ids() in RLS policies)
  └── Ready for migration 003

20261112175958_003_profiles_memberships_roles_permissions.sql
  ├─ Creates: profiles, roles, permissions, role_permissions, organization_members tables
  ├─ Depends on: Migration 001 (private.current_org_ids()), Migration 002 (organizations table)
  └── Required by: Migration 004 (invitations table references organizations, profiles, roles)

20261112180002_004_invitations.sql
  ├─ Creates: invitations table, RLS policies, accept_invitation RPC, public.accept_invitation wrapper
  ├─ Depends on: Migration 003 (organizations, profiles, roles tables)
  └── Depends on: Migration 001 (private.current_org_ids() in RLS policies)
```

## Code Changes Summary

### Migration Files (4 files modified)

| File | Changes |
|---|---|
| `001_extensions_and_common_functions.sql` | Removed `comment on migration ...` (invalid SQL) |
| `002_organizations.sql` | Removed `comment on migration ...`; removed `organizations_insert_onboarding` policy (references `organization_members` from migration 003) |
| `20261112175958_003_profiles_memberships_roles_permissions.sql` | Fixed `group` → `"group"` (reserved word); fixed `change_member_role` variable collision; fixed `invite_member` lock ordering; fixed `invite_member` membership check; removed `revoke update (accepted_at, revoked_at) on public.invitations` (table from migration 004); removed `comment on migration` |
| `20261112180002_004_invitations.sql` | Fixed `accept_invitation` lock ordering (org row first, then invitation row with `FOR UPDATE`); added `public.accept_invitation` wrapper; removed invalid `comment on migration` |

### Application Files (5 files modified)

| File | Change |
|---|---|
| `apps/admin/src/app/(auth)/onboarding\actions.ts` | Removed `createSupabaseAdminClient` import; uses `createServerSupabaseClient()` only |
| `apps/admin/src/app/(auth)\accept-invite\actions.ts` | Removed `createSupabaseAdminClient` import; uses `createServerSupabaseClient()` only |
| `apps/admin/src/app\(auth)\login\page.tsx` | Fixed SSR crash: `window.location.search` computed at render time with `typeof window` guard |
| `apps/admin/src/app\page.tsx` | Added `export const dynamic = "force-dynamic"` |
| `apps/admin\next.config.ts` | Removed `cacheComponents` and `partialPrefetching` |

---

## Test Files Status

| File | Status | Notes |
|---|---|---|
| `supabase/tests/phase2/setup.sql` | CREATED | Creates test organizations, profiles, memberships |
| `supabase/tests/phase2\rls_tests.sql` | CREATED | RLS isolation tests (6 tests) |
| `supabase/tests/phase2\rls_invitations.sql` | CREATED | Invitation tests (6 tests) |
| `supabase/tests/phase2\rbac_tests.sql` | CREATED | RBAC tests (4 tests) |
| `supabase/tests/phase2\concurrency_tests.sql` | CREATED | Concurrency tests (3 tests) |
| `supabase/tests/phase2\run_tests.sql` | CREATED | Master test runner |

**Note:** Test files are ready but have NOT been executed against a database. No PostgreSQL instance is available for execution.

---

## Application Code Verification

| File | Status | Verification |
|---|---|---|
| `apps/admin/src/app/(auth)/onboarding\actions.ts` | VERIFIED | Uses `createServerSupabaseClient()` (not admin client); verifies user session with `supabase.auth.getUser()` |
| `apps/admin/src/app/(auth)\accept-invite\actions.ts` | VERIFIED | Uses `createServerSupabaseClient()` (not admin client); verifies user session with `supabase.auth.getUser()` |
| `apps/admin/src/app\(auth)\login\page.tsx` | VERIFIED | Fixed SSR crash with `typeof window` guard |
| `apps/admin/src/app\page.tsx` | VERIFIED | Added `export const dynamic = "force-dynamic"` |
| `apps/admin\next.config.ts` | VERIFIED | Removed `cacheComponents` and `partialPrefetching` |

---

## Known Limitations

1. **PostgreSQL not available** — Cannot execute migrations or run RLS tests against a real database
2. **`auth.users` table** — Does not exist in standalone PostgreSQL; test setup creates it manually for testing purposes only; production uses Supabase-managed `auth.users`
3. **Concurrency tests** — Cannot be truly concurrent in a single psql session; requires two separate database connections
4. **Test assertions** — Test files contain SQL statements but no formal assertions with PASS/FAIL output

---

## Approval Status

**NOT APPROVED for `supabase db push`** — Pending:
1. Fresh migration execution against a clean PostgreSQL database
2. RLS integration tests with authenticated users
3. Invitation and RBAC tests
4. Concurrency tests
5. User approval for remote migration application