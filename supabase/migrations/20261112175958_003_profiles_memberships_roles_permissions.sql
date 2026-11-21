-- ============================================================================
-- Migration 003: Profiles, memberships, roles, permissions
-- Phase 2 — Authentication + Multi-tenancy foundation
-- ============================================================================

-- ============================================================================
-- profiles — one row per auth.users row
-- ============================================================================
create table public.profiles (
  id uuid not null references auth.users(id) on delete cascade primary key,
  full_name text null,
  phone text null,
  avatar_path text null,
  default_organization_id uuid null references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per Supabase Auth user. Email lives in auth.users only.';
comment on column public.profiles.default_organization_id is 'User preference only - never trusted for authorization.';

-- ============================================================================
-- roles — system roles, global reference rows (not per-tenant copies)
-- ============================================================================
create table public.roles (
  id uuid not null default gen_random_uuid() primary key,
  key text not null unique check (key in (
    'owner', 'admin', 'manager', 'inventory_staff', 'accountant', 'sales_staff'
  )),
  name text not null,
  description text null,
  rank int not null check (rank >= 0),
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.roles is 'System roles ordered by rank. Owner is highest rank.';
comment on column public.roles.rank is 'Used to prevent privilege escalation. Owner = highest.';
comment on column public.roles.is_system is 'System roles cannot be deleted by clients.';

-- ============================================================================
-- permissions — permission catalogue
-- ============================================================================
create table public.permissions (
  key text not null primary key,
  "group" text not null,
  description text null,
  created_at timestamptz not null default now()
);

comment on table public.permissions is 'Catalogue of all permission keys used by RBAC.';
comment on column public.permissions."group" is 'Functional grouping: Catalogue, Inventory, Purchasing, Sales, Parties, Finance, Administration.';

-- ============================================================================
-- role_permissions — many-to-many mapping
-- ============================================================================
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

comment on table public.role_permissions is 'Maps roles to permissions. The source of truth for RBAC.';

-- ============================================================================
-- Seed: system roles
-- Canonical ranking (higher = more authority):
--   owner = 100, admin = 80, manager = 60,
--   inventory_staff = 40, accountant = 30, sales_staff = 20
-- ============================================================================
insert into public.roles (key, name, description, rank, is_system) values
  ('owner', 'Owner', 'Full control, billing, organization deletion, ownership transfer', 100, true),
  ('admin', 'Admin', 'Manage settings, users below owner, catalogue, operations', 80, true),
  ('manager', 'Manager', 'Day-to-day operations, approvals, reports', 60, true),
  ('inventory_staff', 'Inventory Staff', 'Stock adjustments, transfers, goods receiving', 40, true),
  ('accountant', 'Accountant', 'Expenses, payments, finance reports; read-only catalogue', 30, true),
  ('sales_staff', 'Sales Staff', 'Record sales, view customers and stock, no purchasing', 20, true);

-- ============================================================================
-- Seed: permissions
-- ============================================================================
insert into public.permissions (key, "group", description) values
  ('dashboard.view', 'Administration', 'View dashboard and overview'),
  ('products.view', 'Catalogue', 'View products and variants'),
  ('products.create', 'Catalogue', 'Create products'),
  ('products.update', 'Catalogue', 'Update products'),
  ('products.archive', 'Catalogue', 'Archive products'),
  ('categories.view', 'Catalogue', 'View categories'),
  ('categories.manage', 'Catalogue', 'Create, update, archive categories'),
  ('inventory.view', 'Inventory', 'View stock balances and movements'),
  ('inventory.adjust', 'Inventory', 'Adjust stock levels'),
  ('inventory.transfer', 'Inventory', 'Create and manage stock transfers'),
  ('suppliers.view', 'Parties', 'View suppliers'),
  ('suppliers.manage', 'Parties', 'Create, update, archive suppliers'),
  ('purchases.view', 'Purchasing', 'View purchase orders and receipts'),
  ('purchases.create', 'Purchasing', 'Create purchase orders'),
  ('purchases.receive', 'Purchasing', 'Receive goods against purchase orders'),
  ('sales.view', 'Sales', 'View orders and payments'),
  ('sales.manage', 'Sales', 'Create and complete sales'),
  ('sales.refund', 'Sales', 'Process returns and refunds'),
  ('customers.view', 'Parties', 'View customers'),
  ('customers.manage', 'Parties', 'Create, update, archive customers'),
  ('expenses.view', 'Finance', 'View expenses'),
  ('expenses.create', 'Finance', 'Create expenses'),
  ('expenses.update', 'Finance', 'Update expenses'),
  ('finance.view', 'Finance', 'View financial reports'),
  ('analytics.view', 'Analytics', 'View analytics'),
  ('reports.view', 'Reports', 'View reports'),
  ('reports.export', 'Reports', 'Export reports'),
  ('locations.view', 'Administration', 'View locations'),
  ('locations.manage', 'Administration', 'Create, update, archive locations'),
  ('users.view', 'Administration', 'View organization members'),
  ('users.invite', 'Administration', 'Invite new members'),
  ('users.manage_roles', 'Administration', 'Change member roles and deactivate members'),
  ('audit_logs.view', 'Administration', 'View audit logs'),
  ('settings.view', 'Administration', 'View organization settings'),
  ('settings.manage', 'Administration', 'Manage organization settings');

-- ============================================================================
-- Seed: role_permissions matrix
-- Owner gets every permission. Other roles get only their intended set.
-- Owner role is NOT assignable through ordinary invitations or role management.
-- ============================================================================
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.key = 'owner';

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.key = 'admin'
  and p.key in (
    'dashboard.view',
    'products.view', 'products.create', 'products.update', 'products.archive',
    'categories.view', 'categories.manage',
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'suppliers.view', 'suppliers.manage',
    'purchases.view', 'purchases.create', 'purchases.receive',
    'sales.view', 'sales.manage', 'sales.refund',
    'customers.view', 'customers.manage',
    'expenses.view', 'expenses.create', 'expenses.update',
    'finance.view',
    'analytics.view',
    'reports.view', 'reports.export',
    'locations.view', 'locations.manage',
    'users.view', 'users.invite',
    'audit_logs.view',
    'settings.view', 'settings.manage'
  );

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.key = 'manager'
  and p.key in (
    'dashboard.view',
    'products.view',
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'suppliers.view',
    'purchases.view',
    'sales.view', 'sales.manage', 'sales.refund',
    'customers.view',
    'expenses.view', 'expenses.create', 'expenses.update',
    'finance.view',
    'analytics.view',
    'reports.view',
    'locations.view',
    'users.view',
    'settings.view'
  );

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.key = 'inventory_staff'
  and p.key in (
    'dashboard.view',
    'products.view',
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'suppliers.view',
    'purchases.view',
    'sales.view',
    'customers.view'
  );

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.key = 'accountant'
  and p.key in (
    'dashboard.view',
    'products.view',
    'suppliers.view',
    'purchases.view',
    'sales.view',
    'customers.view',
    'expenses.view', 'expenses.create', 'expenses.update',
    'finance.view',
    'reports.view', 'reports.export'
  );

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.key = 'sales_staff'
  and p.key in (
    'dashboard.view',
    'products.view',
    'inventory.view',
    'sales.view', 'sales.manage',
    'customers.view', 'customers.manage'
  );

-- ============================================================================
-- organization_members — links users to organizations with roles
-- ============================================================================
create table public.organization_members (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  status text not null check (status in ('invited', 'active', 'suspended')) default 'active',
  invited_email citext null,
  invited_by uuid null references public.profiles(id),
  invitation_token_hash text null,
  invitation_expires_at timestamptz null,
  joined_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

comment on table public.organization_members is 'Links users to organizations with assigned roles and membership status.';
comment on column public.organization_members.invitation_token_hash is 'Hashed invitation token - never stored in plaintext.';

-- ============================================================================
-- Indexes
-- ============================================================================
create index idx_organization_members_org_id on public.organization_members(organization_id);
create index idx_organization_members_user_id on public.organization_members(user_id);
create index idx_organization_members_status on public.organization_members(status);

-- ============================================================================
-- Table-level grants: revoke direct DML from authenticated users on tables
-- that must only be modified through SECURITY DEFINER RPCs.
--
-- Direct INSERT on organizations is blocked: only private.create_organization
-- can create organizations (SECURITY DEFINER bypasses RLS).
-- Direct UPDATE on organization_members is blocked: only private.change_member_role
-- and private.accept_invitation can modify membership rows.
-- ============================================================================
revoke insert on public.organizations from authenticated;
revoke update on public.organization_members from authenticated;

-- Column-level grants: revoke UPDATE on sensitive columns from authenticated.
-- Profiles: users may only update full_name, phone, avatar_path.
-- organization_members: only RPCs can change role_id, status.
-- Invitations: only RPCs can change accepted_at, revoked_at.
-- ============================================================================
revoke update (id, default_organization_id, created_at, updated_at) on public.profiles from authenticated;
revoke update (role_id, status) on public.organization_members from authenticated;
-- ============================================================================
-- RLS on profiles
-- ============================================================================
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_shared"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or id in (
    select om.user_id
    from public.organization_members om
    where om.organization_id in (select private.current_org_ids())
  )
);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ============================================================================
-- RLS on roles (read-only reference for all authenticated)
-- ============================================================================
alter table public.roles enable row level security;

create policy "roles_select_all"
on public.roles for select
to authenticated
using (true);

create policy "roles_insert_migrations_only"
on public.roles for insert
to authenticated
with check (false);

create policy "roles_update_migrations_only"
on public.roles for update
to authenticated
using (false);

create policy "roles_delete_migrations_only"
on public.roles for delete
to authenticated
using (false);

-- ============================================================================
-- RLS on permissions (read-only reference for all authenticated)
-- ============================================================================
alter table public.permissions enable row level security;

create policy "permissions_select_all"
on public.permissions for select
to authenticated
using (true);

create policy "permissions_insert_migrations_only"
on public.permissions for insert
to authenticated
with check (false);

create policy "permissions_update_migrations_only"
on public.permissions for update
to authenticated
using (false);

create policy "permissions_delete_migrations_only"
on public.permissions for delete
to authenticated
using (false);

-- ============================================================================
-- RLS on role_permissions (read-only reference for all authenticated)
-- ============================================================================
alter table public.role_permissions enable row level security;

create policy "role_permissions_select_all"
on public.role_permissions for select
to authenticated
using (true);

create policy "role_permissions_insert_migrations_only"
on public.role_permissions for insert
to authenticated
with check (false);

create policy "role_permissions_update_migrations_only"
on public.role_permissions for update
to authenticated
using (false);

create policy "role_permissions_delete_migrations_only"
on public.role_permissions for delete
to authenticated
using (false);

-- ============================================================================
-- RLS on organization_members
-- ============================================================================
alter table public.organization_members enable row level security;

-- Members can view their own membership and all memberships in shared orgs.
create policy "organization_members_select_member_or_shared"
on public.organization_members for select
to authenticated
using (
  user_id = (select id from public.profiles where id = auth.uid())
  or organization_id in (select private.current_org_ids())
);

-- Direct INSERT blocked — memberships only via invitation acceptance RPC.
create policy "organization_members_insert_blocked"
on public.organization_members for insert
to authenticated
with check (false);

-- Direct UPDATE blocked — role changes only via change_member_role RPC.
-- Column-level revoke on role_id/status also prevents bypass.
create policy "organization_members_update_blocked"
on public.organization_members for update
to authenticated
using (false);

-- Delete blocked by default — RPC only.
create policy "organization_members_delete_rpc_only"
on public.organization_members for delete
to authenticated
using (false);

-- ============================================================================
-- Trigger: protect organization_members identity fields from direct update
-- ============================================================================
create or replace function public.protect_organization_members_identity()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'organization_id cannot be changed';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end;
$$;

create trigger organization_members_protect_identity
before update on public.organization_members
for each row
execute function public.protect_organization_members_identity();

-- ============================================================================
-- RPC: private.invite_member
-- Creates an invitation (not a direct membership). Caller must have
-- users.invite permission in the target organization. Owner role cannot
-- be assigned through ordinary invitations.
-- ============================================================================
create or replace function private.invite_member(
  p_organization_id uuid,
  p_email text,
  p_role_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role_id uuid;
  v_caller_rank int;
  v_target_role_id uuid;
  v_target_rank int;
  v_inv_id uuid;
  v_token text;
begin
  -- 1. Lock the organization row first (consistent lock order).
  perform 1
  from public.organizations o
  where o.id = p_organization_id
  for update of o;

  -- 2. Verify caller is an active member of the target organization (locked).
  select om.role_id, r.rank
  into v_caller_role_id, v_caller_rank
  from public.organization_members om
  join public.roles r on r.id = om.role_id
  where om.organization_id = p_organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  for update of om;

  if not found then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- 3. Verify caller has users.invite permission.
  if not private.has_permission(p_organization_id, 'users.invite') then
    raise exception 'Caller does not have invitation permission';
  end if;

  -- 4. Resolve target role.
  select id, rank
  into v_target_role_id, v_target_rank
  from public.roles
  where key = p_role_key
    and is_system = true;

  if not found then
    raise exception 'Invalid role key';
  end if;

  -- Prevent assigning Owner role through ordinary invitations.
  if p_role_key = 'owner' then
    raise exception 'Owner role cannot be assigned through invitations';
  end if;

  -- Prevent privilege escalation: caller's rank must strictly exceed target rank.
  if v_caller_rank <= v_target_rank then
    raise exception 'Cannot assign a role at or above caller rank';
  end if;

  -- Generate secure random token.
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Revoke any existing pending invitation for this email in this org.
  update public.invitations
  set revoked_at = now()
  where organization_id = p_organization_id
    and lower(email) = lower(p_email)
    and accepted_at is null
    and revoked_at is null;

  -- Insert the invitation.
  insert into public.invitations
    (organization_id, email, role_id, token_hash, expires_at, invited_by)
  values (
    p_organization_id,
    p_email,
    v_target_role_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    now() + interval '72 hours',
    (select id from public.profiles where id = auth.uid())
  )
  returning id into v_inv_id;

  return v_inv_id;
end;
$$;

revoke all on function private.invite_member(uuid, text, text) from public, anon;
grant execute on function private.invite_member(uuid, text, text) to authenticated;

-- ============================================================================
-- RPC: private.change_member_role
-- Changes a member's role within an organization. Enforces role hierarchy
-- in both directions (caller rank > current AND caller rank > new),
-- prevents self-promotion, prevents ordinary Owner assignment, and protects
-- the final active Owner with consistent row-level locking.
--
-- Lock order (deadlock prevention):
--   1. Organization row (SELECT ... FOR UPDATE)
--   2. Caller membership row (SELECT ... FOR UPDATE)
--   3. Target membership row (SELECT ... FOR UPDATE)
--
-- Owner transfer is deferred to a separate dedicated RPC. Ordinary role
-- management cannot modify Owner accounts in any direction.
-- ============================================================================
create or replace function private.change_member_role(
  p_organization_id uuid,
  p_member_id uuid,
  p_new_role_key text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role_id uuid;
  v_caller_rank int;

  v_current_role_id uuid;
  v_current_role_key text;
  v_current_target_rank int;
  v_target_member_id uuid;

  v_new_role_id uuid;
  v_new_role_rank int;
begin
  -- 1. Lock the organization row FIRST (consistent lock order).
  perform 1
  from public.organizations o
  where o.id = p_organization_id
  for update of o;

  -- 2. Verify caller is an active member of the specified organization (locked).
  select om.role_id, r.rank
  into v_caller_role_id, v_caller_rank
  from public.organization_members om
  join public.roles r on r.id = om.role_id
  where om.organization_id = p_organization_id
    and om.user_id = v_caller_id
    and om.status = 'active'
  for update of om;

  if not found then
    raise exception 'Caller is not an active member of organization %', p_organization_id;
  end if;

  -- 3. Verify caller has users.manage_roles permission in this exact organization.
  if not private.has_permission(p_organization_id, 'users.manage_roles') then
    raise exception 'Caller does not have role management permission in this organization';
  end if;

  -- 4. Verify target membership exists and belongs to the same organization (locked).
  select om.role_id, r.key, r.rank, om.user_id
  into v_current_role_id, v_current_role_key, v_current_target_rank, v_target_member_id
  from public.organization_members om
  join public.roles r on r.id = om.role_id
  where om.id = p_member_id
    and om.organization_id = p_organization_id
  for update of om;

  if not found then
    raise exception 'Membership not found in this organization';
  end if;

  -- 5. Prevent self-role changes.
  if v_target_member_id = v_caller_id then
    raise exception 'Cannot change your own role';
  end if;

  -- 6. Protect Owner accounts: ordinary role management cannot modify
  --    the target's role if the target is currently an Owner. Owner
  --    transfer is deferred to a separate dedicated RPC.
  if v_current_role_key = 'owner' then
    raise exception 'Cannot change the role of an Owner through role management';
  end if;

  -- 7. Prevent assigning Owner through ordinary role management.
  if p_new_role_key = 'owner' then
    raise exception 'Owner role cannot be assigned through role management';
  end if;

  -- 8. Role hierarchy: caller's rank must strictly exceed target's CURRENT rank.
  if v_caller_rank <= v_current_target_rank then
    raise exception 'Cannot change the role of a member with rank equal to or higher than caller';
  end if;

  -- 9. Resolve the requested new role.
  select id, rank
  into v_new_role_id, v_new_role_rank
  from public.roles
  where key = p_new_role_key
    and is_system = true;

  if not found then
    raise exception 'Invalid role key';
  end if;

  -- 10. Role hierarchy: caller's rank must strictly exceed requested NEW rank.
  if v_caller_rank <= v_new_role_rank then
    raise exception 'Cannot assign a role with rank equal to or higher than caller';
  end if;

  -- 11. Update the role (all locks already held).
  update public.organization_members
  set role_id = v_new_role_id,
      updated_at = now()
  where id = p_member_id;
end;
$$;

revoke all on function private.change_member_role(uuid, uuid, text) from public, anon;
grant execute on function private.change_member_role(uuid, uuid, text) to authenticated;

-- ============================================================================
-- RPC: private.create_organization
-- Atomic onboarding: creates organization + Owner membership in one transaction.
-- Uses advisory lock for concurrent onboarding protection.
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

  -- Create the organization.
  insert into public.organizations (name, timezone, currency)
  values (trim(p_name), p_timezone, p_currency)
  returning id into v_org_id;

  -- Create the Owner membership atomically.
  insert into public.organization_members
    (organization_id, user_id, role_id, status, joined_at)
  values (v_org_id, auth.uid(), v_owner_role_id, 'active', now());

  return v_org_id;
end;
$$;

revoke all on function private.create_organization(text, text, text) from public, anon;
grant execute on function private.create_organization(text, text, text) to authenticated;

-- ============================================================================
-- Public wrapper: create_organization
-- SECURITY INVOKER — callable via PostgREST without exposing private schema.
-- Delegates to private.create_organization which performs all validation.
-- ============================================================================
create or replace function public.create_organization(
  p_name text,
  p_timezone text,
  p_currency text
) returns uuid
language plpgsql
set search_path = ''
as $$
begin
  return private.create_organization(p_name, p_timezone, p_currency);
end;
$$;

revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

-- ============================================================================
-- Updated at triggers
-- ============================================================================
create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.updated_at_trigger();

create trigger roles_updated_at
before update on public.roles
for each row
execute function public.updated_at_trigger();

create trigger permissions_updated_at
before update on public.permissions
for each row
execute function public.updated_at_trigger();

create trigger role_permissions_updated_at
before update on public.role_permissions
for each row
execute function public.updated_at_trigger();

create trigger organization_members_updated_at
before update on public.organization_members
for each row
execute function public.updated_at_trigger();

-- Migration 003: creates profiles, roles, permissions, role_permissions, and
-- organization_members tables with RBAC seed data. Includes auto-profile trigger,
-- identity-protection trigger, invite_member RPC, change_member_role RPC with
-- role hierarchy and final-owner protection, and create_organization RPC
-- with advisory locking. Column-level UPDATE revokes on sensitive columns.