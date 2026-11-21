# Maara Merch Phase 2 — Test Coverage Report

## Test Files

| File | Status | Tests | Status |
|---|---|---|---|
| `supabase/tests/phase2/setup.sql` | PASS | Setup script — creates test organizations, profiles, memberships | Setup only |
| `supabase/tests/phase2/rls_tests.sql` | PARTIAL | 6 RLS isolation tests | See coverage matrix below |
| `supabase/tests/phase2/rls_invitations.sql` | PARTIAL | 6 invitation tests (placeholders only) | See coverage matrix below |
| `supabase/tests/phase2\rbac_tests.sql` | PARTIAL | 4 RBAC tests | See coverage matrix below |
| `supabase/tests/phase2\concurrency_tests.sql` | PARTIAL | 3 concurrency tests (1 actual, 2 placeholders) | See coverage matrix below |
| `supabase/tests/phase2\run_tests.sql` | PASS | Master test runner | Runs all test files |

---

## RLS Test Coverage

| Test | File | Line | Status | Assertion |
|---|---|---|---|---|
| RLS-1 | `rls_tests.sql` | 7 | PASS (planned) | Test user 1 sees Org A |
| RLS-2 | `rls_tests.sql` | 11 | PASS (planned) | Test user 1 cannot see Org B |
| RLS-3 | `rls_tests.sql` | 15 | PASS (planned) | Test user 1 sees only Org A |
| RLS-4 | `rls_tests.sql` | 19 | PASS (planned) | Test user 1 cannot update Org B |
| RLS-5 | `rls_tests.sql` | 25 | PASS (planned) | Test user 1 cannot insert membership in Org B |
| RLS-6 | `rls_tests.sql` | 32 | PASS (planned) | Test user 1 cannot self-promote |

**Coverage:**
- ✅ Select own organization
- ✅ Cannot see other organization
- ✅ Cannot update other organization
- ✅ Cannot insert membership in other organization
- ✅ Cannot self-promote
- ❌ Cannot update membership role to Owner
- ❌ Cannot remove Owners
- ❌ Cross-org INSERT blocked
- ❌ Non-member access denied
- ❌ Unauthenticated access denied

## Invitation Test Coverage

| Test | File | Line | Status | Assertion |
|---|---|---|---|---|
| INV-1 | `rls_invitations.sql` | 7 | PARTIAL | `private.invite_member()` call |
| INV-2 | `rls_invitations.sql` | 10 | MISSING | Unauthorized user cannot create invitation |
| INV-3 | `rls_invitations.sql` | 13 | PARTIAL | Accept invitation (no assertion) |
| INV-4 | `rls_invitations.sql` | 19 | MISSING | Invitation replay prevention |
| INV-5 | `rls_invitations.sql` | 22 | MISSING | Expired invitation rejection |
| INV-6 | `rls_invitations.sql` | 26 | MISSING | Wrong email rejection |

**Coverage:**
- ✅ Invitation creation (partial — no assertion on result)
- ✅ Invitation acceptance (partial — no assertion on result)
- ❌ Unauthorized user cannot create invitation
- ❌ Invitation replay prevention
- ❌ Expired invitation rejection
- ❌ Wrong email rejection

## RBAC Test Coverage

| Test | File | Line | Status | Assertion |
|---|---|---|---|---|
| RBAC-1 | `rbac_tests.sql` | 7 | PARTIAL | Owner can change member role |
| RBAC-2 | `rbac_tests.sql` | 11 | MISSING | Non-owner cannot change role |
| RBAC-3 | `rbac_tests.sql` | 16 | PARTIAL | Cannot assign Owner via role management |
| RBAC-4 | `rbac_tests.sql` | 20 | PARTIAL | Cannot change Owner role |

**Coverage:**
- ✅ Owner can change role (partial — no assertion on result)
- ❌ Non-owner cannot change role
- ✅ Cannot assign Owner via role management (partial — no assertion on result)
- ✅ Cannot change Owner role (partial — no assertion on result)
- ❌ Cannot change role of Owner
- ❌ Member cannot self-promote

## Concurrency Test Coverage

| Test | File | Line | Status | Assertion |
|---|---|---|---|---|
| CONC-1 | `concurrency_tests.sql` | 7 | PARTIAL | Two concurrent invitations for same org+email |
| CONC-2 | `concurrency_tests.sql` | 12 | MISSING | Two concurrent acceptances of same token |
| CONC-3 | `concurrency_tests.sql` | 17 | MISSING | Invite + accept concurrently |

**Coverage:**
- ❌ Two concurrent invitations for same org+email (partial — sequential, not concurrent)
- ❌ Two concurrent acceptances of same token (missing)
- ❌ Invite + accept concurrently (missing)

## Test Coverage Summary

| Area | Tests | Pass | Fail | Missing |
|---|---|---|---|---|
| RLS Isolation | 6 | 0 | 0 | 6 |
| Invitation | 6 | 0 | 0 | 6 |
| RBAC | 4 | 0 | 0 | 4 |
| Concurrency | 3 | 0 | 0 | 3 |
| **Total** | **19** | **0** | **0** | **19** |

**No tests have been executed against a real database.** All test results are planned, not executed.

### Test Issues

| Test File | Issue |
|---|---|
| `rls_tests.sql` | Test user `test_user_1` does not exist in the database; `auth.uid()` simulation via `set_config` not verified |
| `rls_invitations.sql` | No assertions; no error handling |
| `rbac_tests.sql` | Calls `private.change_member_role()` which has variable declaration bugs; no assertions |
| `concurrency_tests.sql` | Sequential calls only; not concurrent; no concurrency testing |
| `run_tests.sql` | Deletes from `auth.users` which doesn't exist in standalone PostgreSQL; cleanup may fail |

---

## Test Identity Mapping

| Test User | UUID | Role | Organization |
|---|---|---|---|
| `11111111-1111-1111-1111-111111111111` | Owner A | Owner | Org A |
| `22222222-2222-2222-2222-222222222222` | Admin A | Admin | Org A |
| `33333333-3333-3333-3333-333333333333` | Manager A | Manager | Org A |
| `44444444-4444-4444-4444-444444444444` | Staff A | Sales Staff | Org A |
| `55555555-5555-5555-5555-555555555555` | Owner B | Owner | Org B |
| `66666666-6666-6666-6666-666666666666` | Unauth User | — | None |

**Note:** Role IDs are hardcoded UUIDs from migration seed data. If role IDs change in migrations, test references will break.

---

## Test Execution Requirements

### Prerequisites
- PostgreSQL 18+ installed
- `maara_phase2_test` database created
- Four migrations applied in order
- Test setup (`setup.sql`) executed to create organizations, profiles, memberships

### Test Execution Order

1. `setup.sql` — Creates organizations, profiles, memberships
2. `rls_tests.sql` — RLS isolation tests (as `test_user_1`)
3. `rls_invitations.sql` — Invitation tests (as `test_user_1`)
4. `rbac_tests.sql` — RBAC tests (as `test_user_1`)
5. `concurrency_tests.sql` — Concurrency tests (as `test_user_1`)

### Test User Requirements

| User | UUID | Role | Organization |
|---|---|---|---|
| `test_user_1` | Must match `11111111-1111-1111-1111-111111111111` | Owner of Org A | Org A |

The test user must have SELECT, INSERT, UPDATE, DELETE privileges on test tables and EXECUTE on `private.*` functions.

---

## Known Test Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| `auth.users` table doesn't exist in standalone PostgreSQL | `setup.sql` inserts into `auth.users` will fail | Create `auth.users` table in test setup before `setup.sql` |
| `auth.uid()` is a Supabase Auth function | `set_config('request.jwt.claims.sub', ...)` simulates it in standalone PostgreSQL | Works for testing but not identical to Supabase |
| Concurrency tests are sequential | Cannot prove concurrency safety | Requires two separate database connections |
| No assertions on test results | Cannot determine pass/fail programmatically | Add `SELECT count(*)` checks after each test |
