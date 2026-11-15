-- ============================================================================
-- Migration: locations_foundation
-- Phase 2 — Locations module database foundation
--
-- Creates public.locations and public.user_locations tables with organization
-- scoped RLS, SECURITY DEFINER RPCs for all writes, and audit log events.
--
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. Do not apply to production.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Table: public.locations
-- ============================================================================

create table public.locations (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  code text not null check (code ~ '^[A-Z0-9-]{3,20}$'),
  address jsonb null check (jsonb_typeof(address) = 'object'),
  contact_phone text null,
  contact_email text null,
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  constraint locations_id_organization_id_key
    unique (id, organization_id)
);

comment on table public.locations is 'Store / branch locations, organization-scoped.';
comment on column public.locations.code is 'Unique location code within an organization, uppercase alphanumeric/hyphen, 3-20 characters.';
comment on column public.locations.status is 'active or inactive. Inactive locations cannot be assigned to users but retain historical records.';

-- ============================================================================
-- 2. Indexes on public.locations
-- ============================================================================

create index idx_locations_org_id on public.locations(organization_id);
create index idx_locations_org_status on public.locations(organization_id, status);

-- ============================================================================
-- 3. Updated at trigger on public.locations
-- ============================================================================

create trigger locations_updated_at
  before update on public.locations
  for each row
  execute function public.updated_at_trigger();

-- ============================================================================
-- 4. Table: public.user_locations
-- ============================================================================

create table public.user_locations (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  assigned_by uuid null references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, location_id),
  unique (organization_id, user_id, location_id)
);

comment on table public.user_locations is 'Assigns active organization members to active locations. Composite FKs enforce organization consistency.';
comment on column public.user_locations.assigned_by is 'User who performed the assignment. Null for system-created assignments.';

-- ============================================================================
-- 5. Composite foreign keys enforcing organization consistency
-- ============================================================================

-- (organization_id, user_id) references organization_members(organization_id, user_id)
-- organization_members has a unique constraint on (organization_id, user_id).
alter table public.user_locations
  add constraint fk_user_locations_member
  foreign key (organization_id, user_id)
  references public.organization_members(organization_id, user_id)
  on delete cascade;

-- (location_id, organization_id) references locations(id, organization_id)
-- locations.id is the primary key; (id, organization_id) is unique because id is unique.
alter table public.user_locations
  add constraint fk_user_locations_location
  foreign key (location_id, organization_id)
  references public.locations(id, organization_id)
  on delete cascade;

-- ============================================================================
-- 6. Indexes on public.user_locations
-- ============================================================================

create index idx_user_locations_org_id on public.user_locations(organization_id);
create index idx_user_locations_user_id on public.user_locations(user_id);
create index idx_user_locations_location_id on public.user_locations(location_id);

-- ============================================================================
-- 7. Updated at trigger on public.user_locations
-- ============================================================================

create trigger user_locations_updated_at
  before update on public.user_locations
  for each row
  execute function public.updated_at_trigger();

-- ============================================================================
-- 8. Table-level grants: revoke direct DML from authenticated
-- ============================================================================

REVOKE ALL ON TABLE public.locations
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.user_locations
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.locations TO authenticated;
GRANT SELECT ON TABLE public.user_locations TO authenticated;

-- ============================================================================
-- 9. RLS on public.locations
-- ============================================================================

alter table public.locations enable row level security;

-- Location reads: only users with locations.view in the organization can view its locations.
create policy "locations_select_member"
  on public.locations for select
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('locations.view'))
  );

-- Location writes: only users with locations.manage in the same organization.
create policy "locations_insert_manage"
  on public.locations for insert
  to authenticated
  with check (
    organization_id in (select private.authorized_org_ids('locations.manage'))
  );

create policy "locations_update_manage"
  on public.locations for update
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('locations.manage'))
  )
  with check (
    organization_id in (select private.authorized_org_ids('locations.manage'))
  );

-- Delete blocked by default — archive via status instead.
create policy "locations_delete_blocked"
  on public.locations for delete
  to authenticated
  using (false);

-- ============================================================================
-- 10. RLS on public.user_locations
-- ============================================================================

alter table public.user_locations enable row level security;

-- Assignment reads: only users with locations.view in the organization can view assignments.
create policy "user_locations_select_member"
  on public.user_locations for select
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('locations.view'))
  );

-- Assignment writes: only via SECURITY DEFINER RPCs; direct DML blocked.
create policy "user_locations_insert_blocked"
  on public.user_locations for insert
  to authenticated
  with check (false);

create policy "user_locations_update_blocked"
  on public.user_locations for update
  to authenticated
  using (false);

create policy "user_locations_delete_blocked"
  on public.user_locations for delete
  to authenticated
  using (false);

-- ============================================================================
-- 11. RPC: private.create_location
-- ============================================================================

create or replace function private.create_location(
  p_organization_id uuid,
  p_name text,
  p_code text,
  p_address jsonb,
  p_contact_phone text,
  p_contact_email text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_id uuid;
  v_caller_role_id uuid;
  v_caller_rank int;
begin
  -- Lock the organization row first (consistent lock order with invite_member / change_member_role).
  perform 1
  from public.organizations o
  where o.id = p_organization_id
  for update of o;

  -- Verify caller is an active member of the target organization (locked).
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

  -- Verify caller has locations.manage permission in this organization.
  if not private.has_permission(p_organization_id, 'locations.manage') then
    raise exception 'Caller does not have location management permission in this organization';
  end if;

  -- Validate name.
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 120 then
    raise exception 'Location name must be between 2 and 120 characters';
  end if;

  -- Validate code format.
  if p_code is null or p_code !~ '^[A-Z0-9-]{3,20}$' then
    raise exception 'Location code must be uppercase alphanumeric or hyphen, 3-20 characters';
  end if;

  -- Insert the location.
  insert into public.locations
    (organization_id, name, code, address, contact_phone, contact_email, status)
  values (
    p_organization_id,
    trim(p_name),
    p_code,
    p_address,
    p_contact_phone,
    p_contact_email,
    'active'
  )
  returning id into v_location_id;

  -- Audit log: location.created
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    p_organization_id,
    auth.uid(),
    'location.created',
    'location',
    v_location_id,
    jsonb_build_object(
      'name', trim(p_name),
      'code', p_code
    ),
    now()
  );

  return v_location_id;
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.create_location(uuid, text, text, jsonb, text, text) from public, anon, authenticated;

-- Public wrapper: create_location (SECURITY DEFINER so it can invoke the private function).
create or replace function public.create_location(
  p_organization_id uuid,
  p_name text,
  p_code text,
  p_address jsonb,
  p_contact_phone text,
  p_contact_email text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_location(
    p_organization_id, p_name, p_code, p_address, p_contact_phone, p_contact_email
  );
end;
$$;

revoke all on function public.create_location(uuid, text, text, jsonb, text, text) from public, anon;
grant execute on function public.create_location(uuid, text, text, jsonb, text, text) to authenticated;

-- ============================================================================
-- 12. RPC: private.update_location
-- ============================================================================

create or replace function private.update_location(
  p_location_id uuid,
  p_name text,
  p_code text,
  p_address jsonb,
  p_contact_phone text,
  p_contact_email text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_name text;
  v_old_code text;
  v_old_address jsonb;
  v_old_contact_phone text;
  v_old_contact_email text;
  v_changed_columns text[];
begin
  -- Lock the location row and resolve its organization.
  select l.organization_id, l.name, l.code, l.address, l.contact_phone, l.contact_email
  into v_organization_id, v_old_name, v_old_code, v_old_address, v_old_contact_phone, v_old_contact_email
  from public.locations l
  where l.id = p_location_id
  for update of l;

  if not found then
    raise exception 'Location not found';
  end if;

  -- Verify caller is an active member of the location's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has locations.manage permission in this organization.
  if not private.has_permission(v_organization_id, 'locations.manage') then
    raise exception 'Caller does not have location management permission in this organization';
  end if;

  -- Validate name.
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 120 then
    raise exception 'Location name must be between 2 and 120 characters';
  end if;

  -- Validate code format.
  if p_code is null or p_code !~ '^[A-Z0-9-]{3,20}$' then
    raise exception 'Location code must be uppercase alphanumeric or hyphen, 3-20 characters';
  end if;

  -- Detect changed columns for audit.
  if v_old_name is distinct from trim(p_name) then
    v_changed_columns := array_append(v_changed_columns, 'name');
  end if;
  if v_old_code is distinct from p_code then
    v_changed_columns := array_append(v_changed_columns, 'code');
  end if;
  if v_old_address is distinct from p_address then
    v_changed_columns := array_append(v_changed_columns, 'address');
  end if;
  if v_old_contact_phone is distinct from p_contact_phone then
    v_changed_columns := array_append(v_changed_columns, 'contact_phone');
  end if;
  if v_old_contact_email is distinct from p_contact_email then
    v_changed_columns := array_append(v_changed_columns, 'contact_email');
  end if;

  -- Update the location.
  update public.locations
  set name = trim(p_name),
      code = p_code,
      address = p_address,
      contact_phone = p_contact_phone,
      contact_email = p_contact_email,
      updated_at = now()
  where id = p_location_id;

  -- Audit log: location.updated (only if something changed).
  if v_changed_columns is not null then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      v_organization_id,
      auth.uid(),
      'location.updated',
      'location',
      p_location_id,
      jsonb_build_object(
        'changed_columns', v_changed_columns
      ),
      now()
    );
  end if;
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.update_location(uuid, text, text, jsonb, text, text) from public, anon, authenticated;

-- Public wrapper: update_location (SECURITY DEFINER so it can invoke the private function).
create or replace function public.update_location(
  p_location_id uuid,
  p_name text,
  p_code text,
  p_address jsonb,
  p_contact_phone text,
  p_contact_email text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.update_location(
    p_location_id, p_name, p_code, p_address, p_contact_phone, p_contact_email
  );
end;
$$;

revoke all on function public.update_location(uuid, text, text, jsonb, text, text) from public, anon;
grant execute on function public.update_location(uuid, text, text, jsonb, text, text) to authenticated;

-- ============================================================================
-- 13. RPC: private.archive_location
-- ============================================================================

create or replace function private.archive_location(
  p_location_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  -- Lock the location row and resolve its organization.
  select l.organization_id
  into v_organization_id
  from public.locations l
  where l.id = p_location_id
  for update of l;

  if not found then
    raise exception 'Location not found';
  end if;

  -- Verify caller is an active member of the location's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has locations.manage permission in this organization.
  if not private.has_permission(v_organization_id, 'locations.manage') then
    raise exception 'Caller does not have location management permission in this organization';
  end if;

  -- Archive: set status to inactive. Existing user_location assignments are preserved.
  update public.locations
  set status = 'inactive',
      updated_at = now()
  where id = p_location_id;

  -- Audit log: location.archived
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'location.archived',
    'location',
    p_location_id,
    jsonb_build_object('status', 'inactive'),
    now()
  );
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.archive_location(uuid) from public, anon, authenticated;

-- Public wrapper: archive_location (SECURITY DEFINER so it can invoke the private function).
create or replace function public.archive_location(
  p_location_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.archive_location(p_location_id);
end;
$$;

revoke all on function public.archive_location(uuid) from public, anon;
grant execute on function public.archive_location(uuid) to authenticated;

-- ============================================================================
-- 14. RPC: private.assign_user_to_location
-- ============================================================================

create or replace function private.assign_user_to_location(
  p_user_id uuid,
  p_location_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_location_status text;
  v_assignment_id uuid;
  v_target_member_id uuid;
begin
  -- Resolve the target location's organization and status (locked).
  -- The organization is derived from the location, never from the caller.
  select l.organization_id, l.status
  into v_organization_id, v_location_status
  from public.locations l
  where l.id = p_location_id
  for update of l;

  if not found then
    raise exception 'Location not found';
  end if;

  -- Location must be active to assign.
  if v_location_status <> 'active' then
    raise exception 'Cannot assign to an inactive location';
  end if;

  -- Verify caller is an active member of the location's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has locations.manage permission in this organization.
  if not private.has_permission(v_organization_id, 'locations.manage') then
    raise exception 'Caller does not have location management permission in this organization';
  end if;

  -- Validate target user is an active member of the same organization (locked).
  select om.id
  into v_target_member_id
  from public.organization_members om
  where om.organization_id = v_organization_id
    and om.user_id = p_user_id
    and om.status = 'active'
  for update of om;

  if not found then
    raise exception 'Target user is not an active member of this organization';
  end if;

  -- Insert the assignment. ON CONFLICT DO NOTHING preserves idempotency.
  insert into public.user_locations
    (organization_id, user_id, location_id, assigned_by, assigned_at)
  values (
    v_organization_id,
    p_user_id,
    p_location_id,
    auth.uid(),
    now()
  )
  on conflict (user_id, location_id) do nothing
  returning id into v_assignment_id;

  -- Audit log: user_location.assigned (only when a new assignment was actually created).
  if v_assignment_id is not null then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      v_organization_id,
      auth.uid(),
      'user_location.assigned',
      'user_location',
      v_assignment_id,
      jsonb_build_object(
        'user_id', p_user_id,
        'location_id', p_location_id
      ),
      now()
    );
  end if;

  return coalesce(v_assignment_id, (
    select ul.id
    from public.user_locations ul
    where ul.user_id = p_user_id
      and ul.location_id = p_location_id
  ));
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.assign_user_to_location(uuid, uuid) from public, anon, authenticated;

-- Public wrapper: assign_user_to_location (SECURITY DEFINER so it can invoke the private function).
create or replace function public.assign_user_to_location(
  p_user_id uuid,
  p_location_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.assign_user_to_location(p_user_id, p_location_id);
end;
$$;

revoke all on function public.assign_user_to_location(uuid, uuid) from public, anon;
grant execute on function public.assign_user_to_location(uuid, uuid) to authenticated;

-- ============================================================================
-- 15. RPC: private.unassign_user_from_location
-- ============================================================================

create or replace function private.unassign_user_from_location(
  p_user_id uuid,
  p_location_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_assignment_id uuid;
begin
  -- Verify the assignment exists and resolve its organization (locked).
  -- The organization is derived from the assignment, never from the caller.
  select ul.organization_id, ul.id
  into v_organization_id, v_assignment_id
  from public.user_locations ul
  where ul.user_id = p_user_id
    and ul.location_id = p_location_id
  for update of ul;

  if not found then
    raise exception 'Assignment not found';
  end if;

  -- Verify caller is an active member of the assignment's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has locations.manage permission in this organization.
  if not private.has_permission(v_organization_id, 'locations.manage') then
    raise exception 'Caller does not have location management permission in this organization';
  end if;

  -- Delete the assignment.
  delete from public.user_locations
  where user_id = p_user_id
    and location_id = p_location_id;

  -- Audit log: user_location.unassigned (use captured assignment ID as entity_id).
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'user_location.unassigned',
    'user_location',
    v_assignment_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'location_id', p_location_id
    ),
    now()
  );
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.unassign_user_from_location(uuid, uuid) from public, anon, authenticated;

-- Public wrapper: unassign_user_from_location (SECURITY DEFINER so it can invoke the private function).
create or replace function public.unassign_user_from_location(
  p_user_id uuid,
  p_location_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.unassign_user_from_location(p_user_id, p_location_id);
end;
$$;

revoke all on function public.unassign_user_from_location(uuid, uuid) from public, anon;
grant execute on function public.unassign_user_from_location(uuid, uuid) to authenticated;

-- ============================================================================
-- Migration: locations_foundation — complete
-- ============================================================================

commit;
