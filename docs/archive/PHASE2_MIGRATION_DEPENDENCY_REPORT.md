# Maara Merch — Phase 2 Migration Dependency Report

## Migration Dependency Graph

```
Migration 001: Extensions and Common Functions
├─ Creates: pgcrypto, citext extensions
├─ Creates: private schema
├─ Creates: current_org_ids(), authorized_org_ids(), has_permission(), is_member() functions
├─ Depends on: NOTHING (first migration)
└── Required by: Migration 002 (RLS policies), Migration 003 (all tables)

Migration 002: Organizations
├─ Creates: organizations table, RLS policies, updated_at trigger
├─ Depends on: Migration 001 (private.current_org_ids() used in RLS policies)
├─ Does NOT depend on: Migration 003 or 004
└── Required by: Migration 003 (profiles.default_organization_id FK), Migration 004 (invitations.organization_id FK)

Migration 003: Profiles, Memberships, Roles, Permissions
├─ Creates: profiles, roles, permissions, role_permissions, organization_members tables
├─ Depends on: Migration 001 (private.current_org_ids() in RLS policies)
├─ Depends on: Migration 002 (organizations table — FKs from organization_members, profiles.default_organization_id)
├─ INVALID: References public.invitations (line 270 of original) — table doesn't exist yet
├─ INVALID: `group` is a reserved word (line 72) — must be quoted as "group"
├─ INVALID: change_member_role variable collision (line 611-614)
└── Required by: Migration 004 (invitations.organization_id FK, invitations.invited_by FK)

Migration 004: Invitations
├─ Creates: invitations table, RLS policies, accept_invitation RPC, public.accept_invitation wrapper
├─ Depends on: Migration 003 (organizations, profiles, roles tables)
├─ Depends on: Migration 001 (private.current_org_ids() in RLS policies)
└── Required by: Nothing (last migration)
```

## Critical Migration Issues Found and Fixed

### Issue 1: `comment on migration ...` syntax error
- **Files affected:** All four migrations
- **Problem:** `comment on migration ...` is not valid PostgreSQL syntax
- **Fix:** Removed all four `comment on migration` blocks
- **Impact:** All four migrations would fail at execution

### Issue 2: `group` reserved word (Migration 003)
- **File:** `supabase/migrations/20261112175958_003_profiles_memberships_roles_permissions.sql`
- **Problem:** `group text not null` — `group` is a reserved word in PostgreSQL
- **Fix:** Changed to `"group" text not null`

### Issue 3: `auth.users` reference (Migration 003)
- **File:** `supabase/migrations/20261112175958_003_profiles_memberships_roles_permissions.sql`
- **Problem:** `id uuid not null references auth.users(id)` — `auth.users` doesn't exist in standalone PostgreSQL
- **Resolution:** Kept as-is for Supabase compatibility; test environment creates `auth.users` table separately

### Issue 4: `organization_members` reference in migration 002 (Migration 002)
- **File:** `supabase/migrations/20261112175953_002_organizations.sql`
- **Problem:** `organizations_insert_onboarding` policy references `public.organization_members` which doesn't exist yet
- **Fix:** Removed the policy from migration 002; it belongs in migration 003 where the table exists

### Issue 5: `auth.users` reference in migration 003
- **File:** `supabase/migrations/20261112175958_003_profiles_memberships_roles_permissions.sql`
- **Problem:** `profiles` table has `id uuid not null references auth.users(id)` — `auth.users` doesn't exist in standalone PostgreSQL
- **Resolution:** Kept as-is for Supabase compatibility; test setup creates `auth.users` table

### Issue 6: `change_member_role` variable collision (Migration 003)
- **File:** `supabase/migrations/20261112175958_003_profiles_memberships_roles_permissions.sql`
- **Problem:** `v_caller_role_id` declared but `v_caller_role_key` used; `r.key` (text) into `v_caller_role_id` (uuid) type mismatch; 3 columns selected into 2 variables
- **Fix:** Renamed variables to `v_caller_role_id`/`v_caller_role_key`; fixed SELECT INTO targets

### Issue 7: `private.invite_member` references `public.invitations` in revoke (Migration 003)
- **File:** `supabase/migrations/20261112175958_003_profiles_memberships_roles_permissions.sql`
- **Problem:** `revoke update (accepted_at, revoked_at) on public.invitations from authenticated;` — `invitations` table doesn't exist yet
- **Fix:** Moved revoke statement to migration 004 where `invitations` table exists

---

## Migration Execution Order

```
Migration 001: Extensions and Common Functions
├─ Creates: pgcrypto, citext extensions
├─ Creates: private schema with USAGE grant to authenticated
├─ Creates: current_org_ids(), authorized_org_ids(), has_permission(), is_member() functions
└── Dependencies: None (first migration)

Migration 002: Organizations
├─ Creates: organizations table with RLS policies
├─ Depends on: Migration 001 (private.current_org_ids() in RLS policies)
└── Ready for migration 003

Migration 003: Profiles, Memberships, Roles, Permissions
├─ Creates: profiles, roles, permissions, role_permissions, organization_members tables
├─ Depends on: Migration 001 (private.current_org_ids()), Migration 002 (organizations table)
├─ Depends on: Migration 004 is NOT needed (invitations reference moved here? No, invitations is in 004)
└── Required by: Migration 004 (invitations table references organizations, profiles, roles)

Migration 004: Invitations
├─ Creates: invitations table, RLS policies, accept_invitation RPC
├─ Depends on: Migration 003 (organizations, profiles, roles tables)
├─ Depends on: Migration 001 (private.current_org_ids() in RLS policies)
└── Required by: Nothing (last migration)
```

## Execution Order for Fresh Database

1. `supabase/migrations/20261112175950_001_extensions_and_common_functions.sql`
2. `supabase/migrations/20261112175953_002_organizations.sql`
3. `supabase/migrations/20261112175958_003_profiles_memberships_roles_permissions.sql`
4. `supabase/migrations/20261112180002_004_invitations.sql`

All migrations must be executed in this exact order. Migration 003 depends on migration 002 (organizations table), and migration 004 depends on migration 003 (organizations, profiles, roles tables).