# Maara Merch --- Project Handoff & Working Memory

**Last updated:** 15 November 2026\
**Repository:** `D:\projects\maara`\
**Git remote:** `https://github.com/zerocraft-in/maara.git`\
**Primary branch:** `main`

> This document is a project handoff for a new coding model in OpenCode.
> Treat it as the working source of truth, but verify the current
> repository and Git state before making changes. Never assume a
> reported change is present until you inspect the files.

------------------------------------------------------------------------

## 1. Project purpose

Maara Merch is a clothing-store management and POS system. It is **not
primarily an e-commerce storefront**.

The goal is a complete store operations platform with a unified data
model, including:

-   Dashboard and business overview
-   Products and product variants
-   Inventory and stock by store/location
-   POS / sales / billing
-   Customers
-   Purchases and suppliers
-   Expenses
-   Profit and business analytics
-   Reports
-   Organization, users, roles and permissions
-   Multiple stores / branches (Locations)
-   Audit logs
-   Settings

The user is rebuilding Maara Merch from scratch. Initial implementation
uses **Next.js** for the frontend and dashboard, with **hosted
Supabase** as backend/database/auth. Future scope should be designed
around a robust clothing-store workflow.

## 2. User preferences and working style

-   Communicate in **English or Tamil/Tanglish**. Do not use Chinese.
-   Explain technical work in concise, practical steps.
-   Prefer one command or one focused action at a time; wait for the
    user to paste output before proceeding.
-   User uses Windows PowerShell and VS Code / OpenCode.
-   UI preference: clean, premium, modern **Framer / Apple-inspired**
    design. Avoid glassmorphism and overly generic UI.
-   Preserve existing design and functionality. Do not casually replace
    whole pages or rewrite working components.
-   Make the smallest safe change that fixes the identified issue.
-   Review actual diffs and file contents, not just coding-agent
    completion reports.
-   Do not commit, push, deploy, or run SQL unless the user explicitly
    asks.
-   Never ask the user to paste `.env.local`, API keys, passwords,
    service-role keys, or other secrets.
-   User does **not** need Android development, Docker, or local
    Supabase. Use hosted Supabase and VS Code/OpenCode workflows.
-   No Docker. Do not introduce Docker-based development requirements.
-   User prefers staged changes and explicit verification before
    commits/pushes.

## 3. Technology and local environment

-   Windows project directory: `D:\projects\maara`

-   Monorepo package manager: `pnpm`

-   Admin app package: `@maara/admin`

-   Frontend: Next.js 16.4.6, React, TypeScript, Turbopack in
    development

-   Backend: hosted Supabase (Postgres, Auth, RLS, RPCs)

-   Environment file: `.env.local` (gitignored; secrets must remain
    private)

-   Local development:

    ``` powershell
    cd D:\projects\maara
    pnpm dev
    ```

-   Local app: `http://localhost:3000`

-   Useful validation commands:

    ``` powershell
    pnpm --filter @maara/admin typecheck
    pnpm --filter @maara/admin lint
    pnpm --filter @maara/admin test
    pnpm --filter @maara/admin build
    git diff --check
    ```

-   Do not assume `pnpm test` at the root is equivalent; use the
    package-specific command above.

## 4. Supabase environments --- critical safety boundary

Current project context:

-   **STAGING project ID:** `ftcvyhlzeyqceosdqyxn`
-   STAGING URL: `https://ftcvyhlzeyqceosdqyxn.supabase.co`
-   STAGING project name: `maara-merch-staging`
-   **PRODUCTION project ID:** `qvjhwxriafgobxknpqtq`

### Mandatory rules

1.  Work against STAGING only when database work is explicitly
    authorized.
2.  **Never touch PRODUCTION** (`qvjhwxriafgobxknpqtq`) unless the user
    explicitly gives a separate, clear authorization.
3.  Do not run `supabase db push`.
4.  Do not run local Supabase or Docker.
5.  Do not reapply migrations that have already been applied.
6.  For database changes, first inspect the migration, confirm target
    project, and get explicit approval before applying.
7.  Prefer read-only SQL for diagnosis. Clearly label read-only queries.
8.  Never expose or request `.env.local` contents.
9.  A staging secret key was previously pasted into chat. Recommend
    rotating/revoking that key if it has not already been rotated. Never
    repeat it or ask for it.

Older project IDs `leagpvolhukzdaxubmei` and `jamyqssytdzbiiahtmsq` are
obsolete. Do not use them.

## 5. Git history and working-tree caution

Known milestone commits already made and pushed:

-   `75e3987 feat(auth): complete invited user onboarding`
-   `14359df feat(ui): improve responsive dashboard sidebar`
-   `9fff22c fix(rbac): enforce role-based dashboard navigation`
-   `fb2ea51 feat(settings): add organization settings management`
-   `efa52e0 chore(next): migrate middleware to proxy`

A later RBAC correction was also committed/pushed; its hash was not
recorded here.

### Important current working-tree state

The following Locations and Audit Logs work was previously reported as
**untracked/new files** and not committed or pushed. Verify with
`git status --short` before doing anything:

-   `apps/admin/src/app/(dashboard)/audit-logs/page.tsx`
-   `supabase/migrations/20261114172633_audit_logs_foundation.sql`
-   `apps/admin/src/app/(dashboard)/locations/page.tsx`
-   `apps/admin/src/app/(dashboard)/locations/actions.ts`
-   `apps/admin/src/app/(dashboard)/locations/location-form.tsx`
-   `apps/admin/src/app/(dashboard)/locations/locations-manager.tsx`
-   `supabase/migrations/20261114200000_locations_foundation.sql`

Some files may have been changed since this handoff was prepared. Do not
overwrite, delete, reset, stash, stage, commit, or push them without
checking with the user.

Always start a new coding session with:

``` powershell
cd D:\projects\maara
git status --short
git branch --show-current
git log -5 --oneline
```

## 6. Authentication and organization foundation --- completed on STAGING

### Database repair migrations already applied to STAGING

1.  `supabase/migrations/20261114150000_repair_auth_profiles_and_rls.sql`
    -   SHA256:
        `df36ad639cd19a108ab67afe4903b52ea58a0499cb3db55bc23ab90e0d844b46`
    -   Created `public.handle_new_user()` SECURITY DEFINER trigger on
        `auth.users`.
    -   Backfilled profiles for existing auth users.
    -   Added `private.shared_org_user_ids()` SECURITY DEFINER helper.
    -   Fixed circular RLS policies between profiles and
        organization_members.
    -   Did not create organization/membership rows.
2.  `supabase/migrations/20261114163000_fix_create_organization_slug.sql`
    -   SHA256:
        `93201b8d70a9332322bfa756febb559633d5a6254fbb79ebfedbec83efd89880`
    -   Fixed `private.create_organization` slug generation using
        normalized organization name plus full UUID.

### Test organization created on STAGING

-   Organization: `Maara test`
-   Organization ID: `84d56d3b-2817-4c2e-96a3-6015d528db4e`
-   Slug: `maara-test-84d56d3b28174c2e96a36015d528db4e`
-   Owner user ID: `5405ee3a-46e5-4348-a9df-51a99ca5fff1`
-   Membership: active, role `owner`

Do not confuse this test organization with production.

### Session / user page fixes

-   `apps/admin/src/lib/auth/session.ts` was corrected because PostgREST
    many-to-one embedded relationships return objects, not arrays;
    nullable organization/role embeds are guarded.

-   Dashboard route is `/overview`; `/studio` is not a route.

-   Users page must use explicit FK hint:

    ``` ts
    profiles!organization_members_user_id_fkey ( id, full_name )
    ```

    because `organization_members` has multiple FKs to `profiles`.

-   STAGING grants already applied:

    ``` sql
    GRANT SELECT ON TABLE public.profiles TO authenticated;
    GRANT SELECT ON TABLE public.invitations TO authenticated;
    GRANT UPDATE (full_name) ON TABLE public.profiles TO authenticated;
    ```

-   User emails are fetched server-side through Supabase Admin API;
    service-role key must never reach the browser.

-   Invitation server action uses authenticated session and service-role
    RPC because invite RPC is service_role-only. SMTP uses environment
    configuration; no hardcoded secrets.

-   STAGING Supabase Auth settings:

    -   Site URL: `https://maara-admin-staging.vercel.app`
    -   Redirect URLs include `http://localhost:3000/**` and
        `https://maara-admin-staging.vercel.app/**`
    -   Email confirmation is required on hosted STAGING.

## 7. RBAC --- current known behavior

Existing permissions and role matrix:

-   Owner: all permissions, including `audit_logs.view`,
    `locations.view`, `locations.manage`, user administration.

-   Admin: `audit_logs.view`, `locations.view`, `locations.manage`.

-   Manager: `locations.view`, but **not** `locations.manage`; does not
    have `audit_logs.view`.

-   Accountant, inventory_staff, sales_staff: do not have
    `locations.view` or `locations.manage`; do not have
    `audit_logs.view`.

-   Manager has `users.view`, not `users.invite`.

-   Sales Staff sidebar should show only Overview, Products, Inventory,
    Sales, Customers; direct `/users` access is denied.

-   The role-permission query in `session.ts` must retain:

    ``` ts
    .select(`
      permission_key,
      roles!inner ( key )
    `)
    .eq("roles.key", roleKey);
    ```

    The previous LEFT EMBED filtering was unreliable.

Owner and Sales Staff RBAC were live-tested. Manager live role test was
not confirmed in the previous notes. Do not claim it has passed without
testing.

## 8. Settings module --- complete, committed, deployed, tested

Files: - `apps/admin/src/app/(dashboard)/settings/page.tsx` -
`apps/admin/src/app/(dashboard)/settings/actions.ts` -
`apps/admin/src/app/(dashboard)/settings/settings-form.tsx` -
`supabase/migrations/20261114194500_organization_settings_update_grants.sql`

Behavior: - Server page uses `requireOrganization` and permission
checks. - Server action validates with Zod and updates only approved
organization fields. - Timezone is validated using
`Intl.DateTimeFormat`. - GSTIN and invoice prefix are validated. -
Migration revokes broad UPDATE and grants only:
`name, timezone, gstin, phone, email, invoice_prefix, tax_inclusive_pricing`. -
`invoice_next_number` is not user-editable. - STAGING migration applied
and verified. -
`has_table_privilege(authenticated, organizations, UPDATE)=false`;
allowed column grants verified. - Commit:
`fb2ea51 feat(settings): add organization settings management`. - User
confirmed Settings works.

## 9. Next.js middleware → proxy migration --- complete

-   Next.js 16.4.6 deprecated middleware convention warning.
-   Renamed `apps/admin/src/middleware.ts` to `apps/admin/src/proxy.ts`.
-   Renamed export `middleware` to `proxy`.
-   Typecheck, lint, build and diff checks passed.
-   Build recognized Proxy.
-   Commit: `efa52e0 chore(next): migrate middleware to proxy`.
-   User confirmed deployed and verified.

## 10. Audit Logs module --- STAGING database verified; UI created and tested

### Permission model

-   Owner and Admin have `audit_logs.view`.
-   Manager, Accountant, Inventory Staff, Sales Staff do not.
-   Audit Logs is Owner/Admin only.

### Migration

File: `supabase/migrations/20261114172633_audit_logs_foundation.sql`

-   Applied manually in STAGING SQL Editor. **Do not reapply.**
-   Table `audit_logs` has RLS enabled.
-   Authenticated SELECT true; INSERT/UPDATE/DELETE false; service_role
    INSERT false.
-   SELECT policy uses `private.authorized_org_ids('audit_logs.view')`.
-   Trigger functions are postgres-owned SECURITY DEFINER with empty
    search_path and not executable by authenticated.
-   Trigger events:
    -   organizations BEFORE UPDATE
    -   invitations AFTER INSERT
    -   invitations AFTER UPDATE
    -   organization_members AFTER UPDATE
-   Settings change event was generated by actual STAGING app use;
    metadata example `{"changed_columns":["phone"]}`.
-   `member.invited` metadata only includes email and role_key; actor is
    `actor_user_id`.
-   Invitation cancellation logging was intentionally deferred.

### UI

-   `apps/admin/src/app/(dashboard)/audit-logs/page.tsx`
-   Server-rendered page; handles no active membership by redirecting to
    `/onboarding`.
-   Missing permission redirects to `/overview`.
-   Authenticated client, active organization filtering.
-   Pagination page size 25; fetch 26; stable sort by
    `created_at DESC, id DESC`; page param validation and max page
    10,000.
-   Actor names from authenticated profiles; null actor = System;
    missing profile = Unknown user.
-   Metadata allowlist; timezone read from organization and validated;
    en-GB date/time.
-   Responsive horizontal scroll.
-   Owner/Admin access enforced server-side.
-   Validation passed: typecheck, lint, tests 19/19, build,
    `git diff --check`.
-   User confirmed Owner Audit Logs page worked and displayed
    settings-change events. Do not assume Admin/Sales UI tests were
    completed.

## 11. Locations module --- STAGING migration applied; UI implemented; currently under testing

### Scope and design

-   Store/branch management, contact information, active/inactive
    status, user-to-location assignment.
-   Location-aware inventory foundation only; actual inventory balance
    schema deliberately deferred until products schema exists.
-   Do not invent a products table or inventory_balances table as part
    of Locations.
-   Existing permission keys already seeded: `locations.view`,
    `locations.manage`.
-   `/locations` dashboard navigation placeholder already existed.

### Database migration

File: `supabase/migrations/20261114200000_locations_foundation.sql`

-   Corrected and applied manually to STAGING SQL Editor. **Do not
    reapply.**

-   Initial failure was due to missing unique `(id, organization_id)`
    target; fixed by adding:

    ``` sql
    constraint locations_id_organization_id_key
      unique (id, organization_id)
    ```

-   `locations` includes unique `(organization_id, code)` and unique
    `(id, organization_id)`.

-   `address` is JSONB nullable with check
    `jsonb_typeof(address) = 'object'`.

-   `user_locations` includes composite FKs:

    -   `(organization_id,user_id)` →
        `organization_members(organization_id,user_id)` ON DELETE
        CASCADE
    -   `(location_id,organization_id)` →
        `locations(id,organization_id)` ON DELETE CASCADE

-   There are also redundant single-column FKs, including
    `user_locations_location_id_fkey`; this caused PostgREST ambiguity
    later. Do not remove constraints in this current UI fix.

-   Location creation audit metadata only includes `name` and `code`,
    not full address/phone/email.

-   `assign_user_to_location` locks target active membership row
    `FOR UPDATE` and requires active membership.

-   All five private functions and public wrappers exist. SECURITY
    DEFINER true, empty search_path; private functions not executable by
    authenticated/anon; public wrappers executable by authenticated, not
    anon.

-   RLS enabled on both tables.

-   Authenticated SELECT true; direct INSERT/UPDATE/DELETE false.

-   `locations` SELECT uses
    `private.authorized_org_ids('locations.view')`; INSERT/UPDATE
    require `locations.manage`; DELETE false.

-   `user_locations` SELECT uses `locations.view`; writes only via
    SECURITY DEFINER RPC wrappers.

-   Updated-at triggers exist on both tables.

-   Security verification passed.

-   Redundant FKs are not a current security issue; don't alter them
    now.

### RPCs

-   `create_location`: `p_organization_id`, `p_name`, `p_code`,
    `p_address`, `p_contact_phone`, `p_contact_email`
-   `update_location`: `p_location_id`, `p_name`, `p_code`, `p_address`,
    `p_contact_phone`, `p_contact_email`
-   `archive_location`: `p_location_id`
-   `assign_user_to_location`: `p_user_id`, `p_location_id`
-   `unassign_user_from_location`: `p_user_id`, `p_location_id`

All ordinary UI actions must use authenticated
`createServerSupabaseClient()` and RPCs; no direct table DML and no
service-role client.

### UI files

-   `apps/admin/src/app/(dashboard)/locations/page.tsx`
-   `apps/admin/src/app/(dashboard)/locations/actions.ts`
-   `apps/admin/src/app/(dashboard)/locations/location-form.tsx`
-   `apps/admin/src/app/(dashboard)/locations/locations-manager.tsx`

Features: - `/locations` server page, `locations.view` permission
check. - List name/code/contact/status/assigned user count/created
date. - Client-side search by name/code and Active/Inactive/All
filter. - Empty/error states and Create Location action. - Create/edit
forms with Zod/react-hook-form; code uppercase; email/phone
validation. - Archive confirmation; marks location inactive; does not
hard-delete. - User assignment/unassignment per location; active org
members only. - Inactive location assignment disabled in UI and rejected
by RPC. - `locations.manage` controls mutation UI; view-only users see
read-only. - All server actions check
`requirePermission("locations.manage")`. - Reads filtered to active
organization ID. - No cross-org assignment; RPC enforces. - No direct
INSERT/UPDATE/DELETE. - No service role. - Initial typecheck, lint,
tests 19/19, build and diff checks passed.

### Independent security review

-   No critical/high findings.
-   All ten main security checks passed.
-   Medium M1 found missing runtime UUID validation in
    archive/assign/unassign server actions.
-   M1 was fixed in `actions.ts` with Zod UUID validation before RPC
    execution.
-   `archiveLocation`: `id` UUID.
-   `assignUserToLocation` and `unassignUserFromLocation`: `user_id`,
    `location_id` UUID.
-   Permission checks remain before validation.
-   Existing RPC names and parameter mappings unchanged.
-   Typecheck, lint, tests 19/19, build and diff-check passed after M1.
-   Minor deferred items: locations list pagination, duplicate archive
    audit events if repeatedly archived, client loading indicator. Do
    not expand current scope to these.

### Locations page PGRST201 bug --- fixed locally

Initial local page error:

    Locations load failed. {
      code: 'PGRST201',
      message: "Could not embed because more than one relationship was found for 'locations' and 'user_locations'"
    }

Cause: two FKs from `user_locations` to `locations`: - composite
`fk_user_locations_location` - single-column
`user_locations_location_id_fkey`

The locations page nested select was corrected from:

``` ts
user_locations ( user_id )
```

to:

``` ts
user_locations!fk_user_locations_location ( user_id )
```

This explicitly uses the composite FK `(location_id, organization_id)` →
`(id, organization_id)`.

Only `apps/admin/src/app/(dashboard)/locations/page.tsx` changed for
this fix. Typecheck, lint, tests 19/19, build and `git diff --check`
passed. User confirmed the page now loads without PGRST201 and displays
the empty state.

### Current location test data and address behavior

User created a test location in local app: - Name: `Main Branch` - Code:
`MAIN-001` - Status: Active - Created date displayed: 15/11/2026 -
Actual STAGING DB read-only query confirmed: `json   {"raw":"KADAYAM"}`
for `locations.address`, with `jsonb_typeof(address) = 'object'`.

Address is correctly persisted. It was not displayed in the table, and
edit form read-back expected a string instead of `{ raw: "..." }`.

The current intended minimal UI fix is in progress. A read-only trace
found: - `actions.ts` sends
`p_address: address ? { raw: address.trim() } : null`. - SQL RPC
parameter is `jsonb`; DB column is JSONB with object check; insert
writes `p_address`. - Thus `{ raw: "KADAYAM" }` is the intended valid
storage format. - `location-form.tsx` currently had:
`ts   const addressValue = typeof location?.address === "string" ? location.address : "";`
This incorrectly yields empty string for `{raw:"..."}`. -
`locations-manager.tsx` contact column only displays phone/email, not
address.

The planned fix is to modify ONLY: 1.
`apps/admin/src/app/(dashboard)/locations/location-form.tsx` - Extract
`address.raw` when address is an object. - Retain backward compatibility
for plain string. - Populate edit form; create mode remains empty. 2.
`apps/admin/src/app/(dashboard)/locations/locations-manager.tsx` -
Display address under location name or dedicated column. - Safely handle
null/empty/malformed address. - Never render `[object Object]`. -
Preserve responsive design.

A focused OpenCode prompt was given to do exactly this. **Wait for the
user's OpenCode report/output before assuming the fix is complete.** Do
not change DB, migration, RPC, grants, RLS, or other files.

## 12. OpenCode / free model handoff guidance

The user wants to move the entire Maara project context into OpenCode
and use the best available free model.

This document is intended to be saved into the repo as a durable project
memory file, e.g.: `docs/PROJECT_CONTEXT.md`

For a new OpenCode session: 1. Open `D:\projects\maara`. 2. Read this
document completely before coding. 3. Inspect current Git status and
recent history. 4. Inspect relevant source files before making
assumptions. 5. Ask the user which free model/provider options are
currently visible in their OpenCode model picker if model selection is
requested; available free models and rate limits change and must not be
guessed. 6. Prefer the strongest free model available in the user's
configured providers that can handle long-context repository work and
tool calls. Test a small read-only task before assigning large code
changes. 7. If the model has limited context, keep this file plus a
short current-task note in context; do not paste `.env.local` or
secrets. 8. Do not treat this handoff document as proof of the current
code state. Verify actual files and Git state.

### First task for the new model

Continue the Locations address UI fix: - Inspect the current state of
`location-form.tsx` and `locations-manager.tsx`. - Check whether the
two-file address display/read-back fix has already been implemented by
the previous OpenCode session. - If not, implement only the approved
scope described in Section 11. - Run typecheck, lint, tests, build and
`git diff --check`. - Do not commit, push, deploy, run SQL, or modify
database objects. - Report exact changed files and relevant code
excerpts.

------------------------------------------------------------------------

## 13. General operating rules for any coding model

Use these rules for every task:

1.  **Inspect before editing.** Read the relevant files and current Git
    status.
2.  **Minimal scope.** Modify only files necessary for the requested
    task.
3.  **No destructive Git commands.** Never run reset, clean,
    checkout-overwrite, or force operations without explicit approval.
4.  **No unrequested Git operations.** Do not stage, commit, push, or
    create branches unless asked.
5.  **No production operations.** Production Supabase is protected.
6.  **No schema changes by assumption.** Confirm the actual schema and
    migration history first.
7.  **No secret exposure.** Never print `.env.local`, tokens, API keys,
    service-role credentials, or auth files.
8.  **Security first.** Keep server-side authorization, organization
    scoping, RLS, authenticated clients, and RPC boundaries intact.
9.  **Test the actual behavior.** A successful build does not prove
    runtime correctness.
10. **Report clearly.** State files changed, behavior changed,
    validation commands/results, unresolved risks, and any manual tests
    still required.
11. **Stop at the requested boundary.** If asked to investigate only, do
    not edit. If asked to implement locally, do not deploy.
12. **Never claim a database change or test succeeded unless there is
    direct evidence.**

## 14. New-session opening prompt

Paste this into OpenCode after adding this file to the repository:

> Read `docs/PROJECT_CONTEXT.md` completely and treat it as the Maara
> Merch project handoff. First inspect `git status --short`, current
> branch, and recent commits. Do not modify files yet. Summarize the
> project architecture, protected environments, current uncommitted
> work, and the exact pending Locations address UI task. Then inspect
> the two relevant Locations UI files and report whether the address fix
> is already implemented. Do not print secrets, run SQL, touch
> production, stage, commit, push, or deploy.
