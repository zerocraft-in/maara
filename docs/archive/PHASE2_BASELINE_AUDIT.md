# Maara Merch — Phase 2 Baseline Audit Report

## Repository: D:\projects\maara

## Audit Date: Post-fix verification

## 1. Migration File SHA256 Checksums

| File | SHA256 | Status |
|---|---|---|
| `supabase/migrations/20261112175950_001_extensions_and_common_functions.sql` | `0b63123466020a8952b721210e921989d4cf1643f154de0c8733788301998913` | Corrected |
| `20261112175953_002_organizations.sql` | `9a8f05bd615e25e801e5330f4bd7d5524da48aa1aa2ee3c309e3352c56cbbad3` | Corrected |
| `20261112175958_003_profiles_memberships_roles_permissions.sql` | `5d1b4a7707b627c41710c99f7d6f4de38b0b996e2afce1a2bf1189abb76c0936` | Corrected |
| `20261112180002_004_invitations.sql` | `ca51c0a12feb44e1cc152a7278392324c3d23693a722904dd4899b1ca4695ed1` | Corrected |

## 2. Migration 001 — Extensions and Common Functions

### Findings

| # | Location | Issue | Resolution |
|---|---|---|---|
| 1 | Line 126-128 (original) | `comment on migration ...` — invalid PostgreSQL syntax | Removed |
| 2 | All | `private` schema usage grant present | Correct |
| 3 | All | Helper functions SECURITY DEFINER with `set search_path = ''` | Correct |
| 4 | All | `revoke all ... from public, anon; grant execute ... to authenticated` | Correct |

### Issues Resolved

- Removed invalid `comment on migration ...` statement
- Verified all helper functions use `security definer` and `set search_path = ''`
- Verified all functions have proper `revoke all ... from public, anon; grant execute ... to authenticated`

---

## 5. Migration 002 — Organizations

### Findings

| # | Location | Issue | Resolution |
|---|---|---|---|
| 1 | Line 93-96 (original) | `comment on migration ...` — invalid PostgreSQL syntax | Removed |
| 2 | Line 46-54 (original) | `organizations_insert_onboarding` policy references `organization_members` which doesn't exist yet (created in migration 003) | Removed from migration 002; will be added to migration 003 where the table exists |
| 3 | All | RLS policies, `updated_at_trigger`, schemas | Correct |

### Issues Resolved

- Removed invalid `comment on migration ...` statement
- Removed `organizations_insert_onboarding` policy (references `organization_members` table from migration 003)
- Migration 002 now cleanly creates `organizations` table with RLS policies

---

## 6. Migration 003 — Profiles, Memberships, Roles, Permissions

### Findings

| # | Location | Issue | Resolution |
|---|---|---|---|
| 1 | Line 72 (original) | `group text not null` — `group` is a reserved word | Changed to `"group" text not null` |
| 2 | Line 270 (original) | `revoke update (accepted_at, revoked_at) on public.invitations` — references table from migration 004 | Removed (will be in migration 004) |
| 3 | Line 268 (original) | `comment on column ... unique_constraint` — column doesn't exist | Removed |
| 4 | Line 492-664 | `change_member_role` variable collision — `v_caller_role_id` declared but `v_caller_role_key` used; `r.key` (text) into `v_caller_role_id` (uuid) type mismatch; 3 columns selected into 2 variables | Fixed: separate variables `v_caller_role_id`, `v_caller_role_key`; proper SELECT INTO |
| 5 | Line 611-614 | `select om.role_id, r.key, r.rank into v_caller_role_id, v_caller_rank` — 3 columns into 2 variables | Fixed: separate variables for each column |
| 6 | Line 458-527 | `invite_member` — no organization lock; no concurrent invitation protection | Fixed: added `SELECT ... FOR UPDATE` on organization first; added membership check |
| 7 | Line 533-537 | `revoke all on function private.invite_member` | Kept, correct |
| 8 | Line 734-739 | `create_organization` — advisory lock, proper validation | Correct |
| 9 | Line 742-765 | `comment on migration ...` — invalid syntax | Removed |
| 10 | Line 272-276 | `revoke update (accepted_at, revoked_at) on public.invitations` — table from migration 004 | Removed (now in migration 004) |

### Issues Resolved

- Fixed `group` → `"group"` reserved word
- Removed `revoke update ... on public.invitations` (table from migration 004)
- Fixed `change_member_role` variable declarations and SELECT INTO targets
- Fixed `invite_member` lock ordering and membership checks
- Removed invalid `comment on migration ...`
- Removed invalid `comment on column ... unique_constraint`

---

## 7. Migration 004 — Invitations

| Check | Status | Detail |
|---|---|---|
| `create table public.invitations` | PASS | Valid FKs |
| `create index` statements | PASS | All 3 indexes |
| `create unique index idx_invitations_pending_org_email` | PASS | Conditional unique index |
| `revoke insert/update on public.invitations` | PASS | Table-level revokes |
| `revoke update (accepted_at, revoked_at)` | PASS | Column-level revoke |
| `alter table public.invitations enable row level security` | PASS | Enabled |
| RLS policies (select, insert, update, delete) | PASS | All correct |
| `public.protect_invitations_immutable()` trigger function | PASS | Valid |
| `invitations_protect_immutable` trigger | PASS | Valid |
| `private.accept_invitation(p_token text)` SECURITY DEFINER | PASS | Proper lock order, validation |
| `public.accept_invitation(p_token text)` SECURITY INVOKER wrapper | PASS | Proper delegation |
| `comment on migration ...` (line 272-276) | FAIL | Invalid PostgreSQL syntax — removed |

### Issues Resolved

- Removed invalid `comment on migration ...` statement
- All other elements verified correct

---

## 8. Test Files

| File | Status | Issues |
|---|---|---|
| `setup.sql` | PASS | Creates test data, references `auth.users` (needs compatibility layer) |
| `rls_tests.sql` | PASS | Valid RLS isolation tests |
| `rls_invitations.sql` | PARTIAL | Only 1 test, incomplete |
| `rbac_tests.sql` | PARTIAL | Only 4 tests, incomplete |
| `concurrency_tests.sql` | PARTIAL | Only 1 test, sequential not concurrent |
| `run_tests.sql` | PASS | Master runner |

### Issues Resolved

- None yet — test files need to be expanded with actual assertions

---

## 9. Application Files

| File | SHA256 | Status |
|---|---|---|
| `apps/admin/src/app/(auth)/onboarding\actions.ts` | `6bdfb9e64fc329a46a6356b37816f7d20984dfec61b1c0e69931281e74033e3b` | Uses `createServerSupabaseClient()` |
| `apps/admin/src/app/(auth)\accept-invite\actions.ts` | `6622760b4a4fa759dbecac12b23a9554273f9879852af1f0d889eab5e8b4f859` | Uses `createServerSupabaseClient()` |
| `apps/admin/src/app\(auth)\login\page.tsx` | `c3442bff89a1870699436dd666fbb6b420c6a17af4cb6be835dd49205943cbcf` | Fixed SSR crash |
| `apps/admin/src/app\page.tsx` | `8bbaaeb93cf431856327b389a90456e717abdffa5f46817f12f8cddbb9f899ad` | Added `dynamic = "force-dynamic"` |
| `apps/admin\next.config.ts` | `a0354edd3f40bfed6dd90a552c0cb93fb2af1e02bcca033a6d12e8e305b7b3b5` | Removed `cacheComponents` and `partialPrefetching` |
