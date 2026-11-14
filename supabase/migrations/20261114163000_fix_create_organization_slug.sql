-- ============================================================================
-- Fix: private.create_organization does not supply public.organizations.slug
--
-- Target: hosted Supabase STAGING. Forward-only migration. It does not modify
-- or drop any historical migration, and it creates no organizations or
-- organization memberships of its own.
--
-- Root cause
-- ----------
-- public.organizations.slug is declared as:
--
--   slug text not null unique check (slug ~ '^[a-z0-9-]+$')
--
-- It has NO default and is NOT NULL. The original private.create_organization
-- function inserted into public.organizations with only:
--
--   insert into public.organizations (name, timezone, currency)
--
-- so slug was omitted and evaluated to NULL. Every call therefore failed with:
--
--   ERROR:  null value in column "slug" of relation "organizations"
--           violates not-null constraint          (SQLSTATE 23502)
--
-- The failure is deterministic and happens for every caller, so organization
-- onboarding never succeeded and no organization membership was ever created.
--
-- Fix
-- ---
-- Replace private.create_organization with CREATE OR REPLACE FUNCTION, keeping
-- the exact same signature, return type and all existing behaviour:
--
--   * the user-specific advisory transaction lock;
--   * the profile existence check;
--   * the "already has an active membership" check;
--   * the organization name, timezone and currency validation;
--   * the owner role lookup;
--   * the atomic creation of the organization and its Owner membership.
--
-- The only change is that the organization id is generated up front and a
-- unique, URL-safe slug is derived from the organization name and inserted
-- explicitly alongside it.
--
-- CREATE OR REPLACE is used deliberately. It preserves the existing function
-- owner and the existing EXECUTE grants, so no privilege churn is required
-- and no dependent objects (such as the public.create_organization wrapper)
-- are disturbed.
-- ============================================================================

-- ============================================================================
-- 0. Fail-fast preconditions
--
-- Everything below depends on these invariants. If any of them does not
-- hold, abort before making any change rather than applying a partial fix.
-- ============================================================================
do $$
declare
  v_proc_oid oid;
  v_owner text;
  v_definer boolean;
  v_return_type text;
  v_slug_columns int;
  v_slug_not_null int;
begin
  -- 0.1 The target function must exist with the expected signature.
  v_proc_oid := to_regprocedure('private.create_organization(text, text, text)');

  if v_proc_oid is null then
    raise exception 'PRECONDITION FAILED: private.create_organization(text, text, text) does not exist';
  end if;

  select p.prorettype::regtype::text, pg_get_userbyid(p.proowner), p.prosecdef
    into v_return_type, v_owner, v_definer
    from pg_proc p
   where p.oid = v_proc_oid;

  if v_return_type <> 'uuid' then
    raise exception 'PRECONDITION FAILED: private.create_organization returns %, expected uuid', v_return_type;
  end if;

  -- 0.2 The existing function must be a postgres-owned SECURITY DEFINER
  --     function. CREATE OR REPLACE below will preserve both.
  if v_owner <> 'postgres' then
    raise exception 'PRECONDITION FAILED: private.create_organization is owned by %, expected postgres', v_owner;
  end if;

  if not v_definer then
    raise exception 'PRECONDITION FAILED: private.create_organization is not SECURITY DEFINER';
  end if;

  -- 0.3 public.organizations.slug must exist and be NOT NULL. That is the
  --     column this migration starts supplying.
  select count(*) into v_slug_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'organizations'
     and column_name = 'slug';

  if v_slug_columns = 0 then
    raise exception 'PRECONDITION FAILED: public.organizations.slug does not exist';
  end if;

  select count(*) into v_slug_not_null
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'organizations'
     and column_name = 'slug'
     and is_nullable = 'NO';

  if v_slug_not_null = 0 then
    raise exception 'PRECONDITION FAILED: public.organizations.slug is not NOT NULL';
  end if;

  raise notice 'Preconditions satisfied.';
end;
$$;

-- Capture the current ACL so the postconditions below can prove that
-- CREATE OR REPLACE left the existing grants untouched.
select set_config(
         'maara.create_organization_pre_acl',
         coalesce(p.proacl::text, '<null acl>'),
         false)
  from pg_proc p
 where p.oid = to_regprocedure('private.create_organization(text, text, text)');

-- ============================================================================
-- 1. Replace private.create_organization
--
-- CREATE OR REPLACE with an unchanged signature and return type preserves the
-- existing owner (postgres) and the existing EXECUTE grants. No DROP is
-- performed and no grant is re-issued.
--
-- Slug generation
-- --------------
--   1. The organization id is generated first with gen_random_uuid().
--   2. The base slug is derived from the organization name: trimmed,
--      lowercased, every run of characters outside [a-z0-9] collapsed to a
--      single '-', and leading/trailing '-' removed. This satisfies the
--      column check constraint slug ~ '^[a-z0-9-]+$'.
--   3. If that leaves an empty string (for example a name made only of
--      symbols), the base slug falls back to 'org'.
--   4. The full hyphen-free UUID (all 32 hex characters, not truncated) is
--      appended after a '-'. Because the UUID is unique this also guarantees
--      the slug satisfies the UNIQUE constraint, with no collision retry
--      loop and no chance of a failed insert.
-- ============================================================================
create or replace function private.create_organization(
  p_name text,
  p_timezone text,
  p_currency text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_owner_role_id uuid;
  v_lock_key bigint;
  v_slug text;
begin
  -- User-specific advisory lock: hash of user id.
  select (hashtext(auth.uid()::text) % 100000)::bigint into v_lock_key;
  perform pg_advisory_xact_lock(v_lock_key);

  -- Re-check after lock: profile must exist.
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profile not found for authenticated user';
  end if;

  -- Re-check after lock: user must not already have active membership.
  if exists (
    select 1 from public.organization_members
    where user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'User already belongs to an active organization';
  end if;

  -- Validate organization name.
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 120 then
    raise exception 'Organization name must be between 2 and 120 characters';
  end if;

  -- Validate timezone.
  if p_timezone is null or trim(p_timezone) = '' then
    raise exception 'Timezone is required';
  end if;

  -- Validate currency.
  if p_currency is null or char_length(p_currency) <> 3 then
    raise exception 'Currency must be a 3-letter ISO code';
  end if;

  -- Validate owner role exists.
  select id into v_owner_role_id from public.roles where key = 'owner' and is_system = true;
  if v_owner_role_id is null then
    raise exception 'Owner role not found';
  end if;

  -- Generate the organization id first so the slug suffix is guaranteed unique.
  v_org_id := gen_random_uuid();

  -- Derive a URL-safe slug from the organization name. Lowercased, every run
  -- of characters outside [a-z0-9] collapsed to a single '-', leading and
  -- trailing '-' removed. Satisfies slug ~ '^[a-z0-9-]+$'.
  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));

  -- Fall back to 'org' when the name yields an empty slug.
  if v_slug is null or v_slug = '' then
    v_slug := 'org';
  end if;

  -- Append the full hyphen-free UUID so the UNIQUE constraint is always
  -- satisfied without a retry loop.
  v_slug := v_slug || '-' || replace(v_org_id::text, '-', '');

  -- Create the organization.
  insert into public.organizations (id, name, slug, timezone, currency)
  values (v_org_id, trim(p_name), v_slug, p_timezone, p_currency)
  returning id into v_org_id;

  -- Create the Owner membership atomically.
  insert into public.organization_members
    (organization_id, user_id, role_id, status, joined_at)
  values (v_org_id, auth.uid(), v_owner_role_id, 'active', now());

  return v_org_id;
end;
$$;

-- ============================================================================
-- 2. Postconditions
--
-- Proves that CREATE OR REPLACE preserved ownership, SECURITY DEFINER and
-- the existing EXECUTE grants, and that the public RPC remains reachable by
-- authenticated users. Aborts the migration if any of this regressed.
-- ============================================================================
do $$
declare
  v_owner text;
  v_definer boolean;
  v_acl text;
  v_pre_acl text;
begin
  select pg_get_userbyid(p.proowner), p.prosecdef, coalesce(p.proacl::text, '<null acl>')
    into v_owner, v_definer, v_acl
    from pg_proc p
   where p.oid = to_regprocedure('private.create_organization(text, text, text)');

  -- 2.1 Ownership preserved.
  if v_owner <> 'postgres' then
    raise exception 'POSTCONDITION FAILED: private.create_organization is owned by %, expected postgres', v_owner;
  end if;

  -- 2.2 SECURITY DEFINER preserved.
  if not v_definer then
    raise exception 'POSTCONDITION FAILED: private.create_organization is no longer SECURITY DEFINER';
  end if;

  -- 2.3 The existing grants are intact: the ACL is byte-for-byte what it
  --     was before the CREATE OR REPLACE.
  v_pre_acl := current_setting('maara.create_organization_pre_acl', true);

  if v_pre_acl is null then
    raise exception 'POSTCONDITION FAILED: pre-change ACL was not captured';
  end if;

  if v_acl is distinct from v_pre_acl then
    raise exception 'POSTCONDITION FAILED: EXECUTE grants changed (before: %, after: %)', v_pre_acl, v_acl;
  end if;

  -- 2.4 authenticated can execute the public RPC that the Next.js server
  --     action calls.
  if not has_function_privilege(
       'authenticated',
       'public.create_organization(text, text, text)',
       'EXECUTE') then
    raise exception 'POSTCONDITION FAILED: authenticated cannot execute public.create_organization(text, text, text)';
  end if;

  -- 2.5 authenticated can still execute the private function directly, and
  --     anon still cannot.
  if not has_function_privilege(
       'authenticated',
       'private.create_organization(text, text, text)',
       'EXECUTE') then
    raise exception 'POSTCONDITION FAILED: authenticated cannot execute private.create_organization(text, text, text)';
  end if;

  if has_function_privilege(
       'anon',
       'public.create_organization(text, text, text)',
       'EXECUTE') then
    raise exception 'POSTCONDITION FAILED: anon can execute public.create_organization(text, text, text)';
  end if;

  raise notice 'Postconditions satisfied.';
end;
$$;

-- ============================================================================
-- 3. Post-conditions report (informational only, changes nothing)
--
-- Confirms for the reviewer:
--   * private.create_organization is owned by postgres and is SECURITY DEFINER;
--   * its EXECUTE ACL is unchanged from before this migration;
--   * public.create_organization is still executable by authenticated and not
--     by anon;
--   * no organization or organization_members row was created by this
--     migration.
-- ============================================================================
do $$
declare
  v_owner text;
  v_definer boolean;
  v_acl text;
  v_org_count bigint;
  v_member_count bigint;
  v_auth_can_execute boolean;
  v_anon_can_execute boolean;
begin
  select pg_get_userbyid(p.proowner), p.prosecdef, coalesce(p.proacl::text, '<null acl>')
    into v_owner, v_definer, v_acl
    from pg_proc p
   where p.oid = to_regprocedure('private.create_organization(text, text, text)');

  select has_function_privilege('authenticated', 'public.create_organization(text, text, text)', 'EXECUTE'),
         has_function_privilege('anon', 'public.create_organization(text, text, text)', 'EXECUTE')
    into v_auth_can_execute, v_anon_can_execute;

  select count(*) into v_org_count from public.organizations;
  select count(*) into v_member_count from public.organization_members;

  raise notice 'create_organization owner          : % (security definer: %)', v_owner, v_definer;
  raise notice 'create_organization acl            : %', v_acl;
  raise notice 'public RPC executable by auth     : %', v_auth_can_execute;
  raise notice 'public RPC executable by anon     : %', v_anon_can_execute;
  raise notice 'organizations row count           : %', v_org_count;
  raise notice 'organization_members row count    : %', v_member_count;
end;
$$;
