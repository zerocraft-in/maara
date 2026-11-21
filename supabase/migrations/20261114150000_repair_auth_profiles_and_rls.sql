-- ============================================================================
-- Repair: auth profile creation + circular RLS policy dependencies
--
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. This migration is forward-only and
-- idempotent; it does not modify or drop any historical migration.
--
-- Problems this migration repairs:
--
-- 1. There is no INSERT trigger on auth.users, so a row is never created in
--    public.profiles for a newly signed-up user. Both
--    private.create_organization() and private.accept_invitation() require the
--    caller's profile to exist, and public.organization_members.user_id
--    references public.profiles(id), so onboarding and invitation acceptance
--    both fail with "Profile not found for authenticated user" and no
--    organization membership is ever created.
--
-- 2. public.profiles and public.organization_members have mutually recursive
--    SELECT policies:
--      - organization_members_select_member_or_shared queries public.profiles
--      - profiles_select_own_or_shared queries public.organization_members
--    PostgreSQL aborts any query touching either table with
--    "infinite recursion detected in policy for relation".
--
-- This migration creates a SECURITY DEFINER helper that breaks the cycle,
-- rewrites both SELECT policies to use it, adds the missing auth trigger, and
-- backfills profiles for users that already exist.
--
-- No organization or organization_members rows are created here.
-- ============================================================================

-- ============================================================================
-- 0. Fail-fast preconditions
--
-- Everything below depends on these invariants. If any of them does not hold,
-- the helper would not be able to bypass RLS and the rewrite would not break
-- the recursion. Abort before making any change rather than applying a
-- partial repair.
-- ============================================================================
do $$
declare
  v_profiles_owner text;
  v_members_owner text;
  v_profiles_rls boolean;
  v_members_rls boolean;
  v_profiles_force boolean;
  v_members_force boolean;
  v_current_org_ids_owner text;
  v_current_org_ids_definer boolean;
begin
  -- 0.1 Required relations must exist.
  if to_regclass('public.profiles') is null then
    raise exception 'PRECONDITION FAILED: public.profiles does not exist';
  end if;

  if to_regclass('public.organization_members') is null then
    raise exception 'PRECONDITION FAILED: public.organization_members does not exist';
  end if;

  if to_regprocedure('private.current_org_ids()') is null then
    raise exception 'PRECONDITION FAILED: private.current_org_ids() does not exist';
  end if;

  -- 0.2 RLS must be enabled on both tables.
  select c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner)
    into v_profiles_rls, v_profiles_force, v_profiles_owner
    from pg_class c
   where c.oid = 'public.profiles'::regclass;

  select c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner)
    into v_members_rls, v_members_force, v_members_owner
    from pg_class c
   where c.oid = 'public.organization_members'::regclass;

  if not v_profiles_rls then
    raise exception 'PRECONDITION FAILED: RLS is not enabled on public.profiles';
  end if;

  if not v_members_rls then
    raise exception 'PRECONDITION FAILED: RLS is not enabled on public.organization_members';
  end if;

  -- 0.3 FORCE ROW LEVEL SECURITY must be off. With FORCE enabled the table
  --     owner is subject to RLS, which would re-introduce the recursion that
  --     the SECURITY DEFINER helper exists to break.
  if v_profiles_force then
    raise exception 'PRECONDITION FAILED: FORCE ROW LEVEL SECURITY is enabled on public.profiles';
  end if;

  if v_members_force then
    raise exception 'PRECONDITION FAILED: FORCE ROW LEVEL SECURITY is enabled on public.organization_members';
  end if;

  -- 0.4 Both tables must be owned by postgres, so that a SECURITY DEFINER
  --     function owned by postgres bypasses their RLS.
  if v_profiles_owner <> 'postgres' then
    raise exception 'PRECONDITION FAILED: public.profiles is owned by %, expected postgres', v_profiles_owner;
  end if;

  if v_members_owner <> 'postgres' then
    raise exception 'PRECONDITION FAILED: public.organization_members is owned by %, expected postgres', v_members_owner;
  end if;

  -- 0.5 private.current_org_ids() must be a postgres-owned SECURITY DEFINER
  --     function; the helper below depends on it.
  select p.prosecdef, pg_get_userbyid(p.proowner)
    into v_current_org_ids_definer, v_current_org_ids_owner
    from pg_proc p
   where p.oid = 'private.current_org_ids()'::regprocedure;

  if not v_current_org_ids_definer then
    raise exception 'PRECONDITION FAILED: private.current_org_ids() is not SECURITY DEFINER';
  end if;

  if v_current_org_ids_owner <> 'postgres' then
    raise exception 'PRECONDITION FAILED: private.current_org_ids() is owned by %, expected postgres', v_current_org_ids_owner;
  end if;

  raise notice 'Preconditions satisfied.';
end;
$$;

-- ============================================================================
-- 1. Auto-profile trigger
--
-- SECURITY DEFINER + empty search_path so the insert is fully qualified and
-- cannot be hijacked via a search_path injection. Only the id column is
-- inserted: optional auth.users metadata (raw_user_meta_data, phone, etc.)
-- is not assumed to exist.
--
-- public.profiles has RLS enabled but no INSERT policy, so this insert must
-- run with the privileges of the function owner. The owner is set to postgres
-- below, which is also the owner of public.profiles, so the insert is not
-- subject to the profiles RLS policies.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Pin the owner. The trigger runs the function body with the owner's
-- privileges, so the owner must be a role that bypasses RLS on
-- public.profiles. If ownership cannot be set the migration aborts: a
-- SECURITY DEFINER function owned by any other role would fail to insert.
do $$
begin
  execute 'alter function public.handle_new_user() owner to postgres';
exception
  when insufficient_privilege then
    raise exception 'FATAL: could not set owner of public.handle_new_user() to postgres. Aborting migration. Run it as a role with membership in postgres.';
end;
$$;

-- The trigger must be created before EXECUTE is revoked below: PostgreSQL
-- checks EXECUTE privilege when creating a trigger, and postgres retains the
-- owner's implicit privileges regardless of the revoke.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- The trigger function is only ever invoked as a trigger. It is not a
-- callable API surface, so no client role needs EXECUTE on it. Revoking it
-- from PUBLIC, anon and authenticated does not affect trigger execution:
-- the trigger fires the function under the function owner's privileges.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================================
-- 2. Backfill missing profiles
--
-- Creates a profile row for every auth.users row that does not have one yet.
-- Only the id column is inserted. ON CONFLICT DO NOTHING keeps this safe to
-- re-run and makes it a no-op for users who already have a profile.
--
-- No organization and no organization_members rows are created.
-- ============================================================================
insert into public.profiles (id)
select u.id
from auth.users u
on conflict (id) do nothing;

-- ============================================================================
-- 3. Break the circular RLS dependency
--
-- private.shared_org_user_ids() returns the distinct user ids of everyone who
-- belongs to the organizations the current authenticated user belongs to.
--
-- It queries public.organization_members directly. Because it is SECURITY
-- DEFINER and owned by postgres (the owner of public.organization_members,
-- whose RLS is enabled but NOT forced), the inner query is evaluated with
-- the owner's privileges and does not re-enter the organization_members SELECT
-- policy. That is what removes the recursion.
--
-- private.current_org_ids() is reused to resolve the caller's own active
-- organizations, so the two helpers stay consistent with the rest of the
-- schema.
-- ============================================================================
create or replace function private.shared_org_user_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select distinct om.user_id
  from public.organization_members om
  where om.organization_id in (select private.current_org_ids());
end;
$$;

-- Pin the owner so the RLS bypass is guaranteed. If ownership cannot be set
-- the migration aborts rather than silently leaving a function that cannot
-- bypass RLS and would reintroduce the recursion.
do $$
begin
  execute 'alter function private.shared_org_user_ids() owner to postgres';
exception
  when insufficient_privilege then
    raise exception 'FATAL: could not set owner of private.shared_org_user_ids() to postgres. Aborting migration. Run it as a role with membership in postgres.';
end;
$$;

-- The helper is only used inside RLS policy expressions, which are evaluated
-- as the querying role. Only authenticated users need to call it.
revoke all on function private.shared_org_user_ids() from public, anon;
grant execute on function private.shared_org_user_ids() to authenticated;

-- Assert the helper really is a postgres-owned SECURITY DEFINER function
-- before it is referenced by any policy.
do $$
declare
  v_owner text;
  v_definer boolean;
begin
  select pg_get_userbyid(p.proowner), p.prosecdef
    into v_owner, v_definer
    from pg_proc p
   where p.oid = 'private.shared_org_user_ids()'::regprocedure;

  if v_owner is distinct from 'postgres' then
    raise exception 'ASSERTION FAILED: private.shared_org_user_ids() is owned by %, expected postgres', v_owner;
  end if;

  if not v_definer then
    raise exception 'ASSERTION FAILED: private.shared_org_user_ids() is not SECURITY DEFINER';
  end if;
end;
$$;

-- ============================================================================
-- 4. Rewrite the two SELECT policies
--
-- Both policies are replaced so that neither one references the other table
-- directly:
--
--   organization_members -> uses auth.uid() and private.current_org_ids()
--   profiles            -> uses auth.uid() and private.shared_org_user_ids()
--
-- Access semantics are unchanged:
--   * a member still sees their own membership row;
--   * a member still sees every membership in the organizations they belong to;
--   * a member still sees their own profile and the profiles of everyone in
--     the organizations they belong to.
--
-- public.organization_members.user_id references public.profiles(id), and
-- public.profiles.id references auth.users(id), so user_id is always the
-- caller's own auth user id and comparing it to auth.uid() is equivalent to
-- the previous "select id from public.profiles where id = auth.uid()" lookup,
-- without traversing the other table's policy.
--
-- All other policies, grants and revokes on these tables are left untouched:
-- INSERT/UPDATE/DELETE protections stay in force.
-- ============================================================================
drop policy if exists "organization_members_select_member_or_shared"
  on public.organization_members;

create policy "organization_members_select_member_or_shared"
on public.organization_members for select
to authenticated
using (
  user_id = (select auth.uid())
  or organization_id in (select private.current_org_ids())
);

drop policy if exists "profiles_select_own_or_shared"
on public.profiles;

create policy "profiles_select_own_or_shared"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or id in (select private.shared_org_user_ids())
);

-- ============================================================================
-- 5. Post-conditions report (informational only, changes nothing)
--
-- Confirms for the reviewer:
--   * the new helper and trigger function exist, are SECURITY DEFINER and are
--     owned by postgres;
--   * neither rewritten policy still references the other table directly;
--   * neither table has FORCE ROW LEVEL SECURITY enabled;
--   * every auth.users row now has a matching profile row.
-- ============================================================================
do $$
declare
  v_helper_owner text;
  v_helper_definer boolean;
  v_trigger_owner text;
  v_trigger_definer boolean;
  v_trigger_exec_public text;
  v_profiles_force boolean;
  v_members_force boolean;
  v_missing_profiles bigint;
begin
  select pg_get_userbyid(p.proowner), p.prosecdef
    into v_helper_owner, v_helper_definer
    from pg_proc p
   where p.oid = 'private.shared_org_user_ids()'::regprocedure;

  select pg_get_userbyid(p.proowner), p.prosecdef
    into v_trigger_owner, v_trigger_definer
    from pg_proc p
   where p.oid = 'public.handle_new_user()'::regprocedure;

  select coalesce(p.proacl::text, '<default: owner + PUBLIC>')
    into v_trigger_exec_public
    from pg_proc p
   where p.oid = 'public.handle_new_user()'::regprocedure;

  select relforcerowsecurity into v_profiles_force
    from pg_class where oid = 'public.profiles'::regclass;

  select relforcerowsecurity into v_members_force
    from pg_class where oid = 'public.organization_members'::regclass;

  select count(*) into v_missing_profiles
    from auth.users u
   where not exists (select 1 from public.profiles p where p.id = u.id);

  raise notice 'shared_org_user_ids owner       : % (security definer: %)',
    v_helper_owner, v_helper_definer;
  raise notice 'handle_new_user owner            : % (security definer: %)',
    v_trigger_owner, v_trigger_definer;
  raise notice 'handle_new_user acl              : %', v_trigger_exec_public;
  raise notice 'profiles FORCE RLS               : %', v_profiles_force;
  raise notice 'organization_members FORCE RLS   : %', v_members_force;
  raise notice 'auth.users without a profile      : %', v_missing_profiles;
end;
$$;
