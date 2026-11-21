-- ============================================================================
-- Migration: categories_foundation
-- Phase 2 — Categories module database foundation
--
-- Creates public.categories with organization-scoped RLS, SECURITY DEFINER
-- RPCs for all writes, and audit log events.
--
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. Do not apply to production.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Table: public.categories
-- ============================================================================

create table public.categories (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) between 1 and 140
  ),
  description text null check (description is null or char_length(description) <= 1000),
  sort_order integer not null default 0 check (sort_order >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  constraint categories_id_organization_id_key
    unique (id, organization_id)
);

comment on table public.categories is 'Product categories, organization-scoped. Flat hierarchy for now.';
comment on column public.categories.slug is 'Generated from the category name at creation time; unique within an organization.';
comment on column public.categories.status is 'active or inactive. Inactive categories are archived but retain historical records.';

-- ============================================================================
-- 2. Indexes on public.categories
-- ============================================================================

create index idx_categories_org_id on public.categories(organization_id);
create index idx_categories_org_status on public.categories(organization_id, status);
create index idx_categories_org_sort on public.categories(organization_id, sort_order, name);

-- ============================================================================
-- 3. Updated at trigger on public.categories
-- ============================================================================

create trigger categories_updated_at
  before update on public.categories
  for each row
  execute function public.updated_at_trigger();

-- ============================================================================
-- 4. Table-level grants: revoke direct DML from authenticated
-- ============================================================================

REVOKE ALL ON TABLE public.categories
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.categories TO authenticated;

-- ============================================================================
-- 5. RLS on public.categories
-- ============================================================================

alter table public.categories enable row level security;

-- Category reads: only users with categories.view in the organization.
create policy "categories_select_member"
  on public.categories for select
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('categories.view'))
  );

-- Category writes: only users with categories.manage in the same organization.
create policy "categories_insert_manage"
  on public.categories for insert
  to authenticated
  with check (
    organization_id in (select private.authorized_org_ids('categories.manage'))
  );

create policy "categories_update_manage"
  on public.categories for update
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('categories.manage'))
  )
  with check (
    organization_id in (select private.authorized_org_ids('categories.manage'))
  );

-- Delete blocked by default — archive via status instead.
create policy "categories_delete_blocked"
  on public.categories for delete
  to authenticated
  using (false);

-- ============================================================================
-- 6. RPC: private.create_category
-- ============================================================================

create or replace function private.create_category(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_sort_order integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_id uuid;
  v_caller_role_id uuid;
  v_caller_rank int;
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
begin
  -- Lock the organization row first (consistent lock order with other RPCs).
  perform 1
  from public.organizations o
  where o.id = p_organization_id
  for update of o;

  if not found then
    raise exception 'Organization not found';
  end if;

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

  -- Verify caller has categories.manage permission in this organization.
  if not private.has_permission(p_organization_id, 'categories.manage') then
    raise exception 'Caller does not have category management permission in this organization';
  end if;

  -- Validate name.
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 120 then
    raise exception 'Category name must be between 2 and 120 characters';
  end if;

  -- Validate description.
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'Category description must be at most 1000 characters';
  end if;

  -- Validate sort order.
  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'Sort order must be zero or greater';
  end if;

  -- Generate a URL-safe slug from the name, unique within the organization.
  v_base_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'category';
  end if;

  v_slug := v_base_slug;
  while exists (
    select 1
    from public.categories c
    where c.organization_id = p_organization_id
      and c.slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  -- Insert the category.
  insert into public.categories
    (organization_id, name, slug, description, sort_order, status)
  values (
    p_organization_id,
    trim(p_name),
    v_slug,
    nullif(trim(p_description), ''),
    p_sort_order,
    'active'
  )
  returning id into v_category_id;

  -- Audit log: category.created
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    p_organization_id,
    auth.uid(),
    'category.created',
    'category',
    v_category_id,
    jsonb_build_object('name', trim(p_name)),
    now()
  );

  return v_category_id;
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.create_category(uuid, text, text, integer) from public, anon, authenticated;

-- Public wrapper: create_category (SECURITY DEFINER so it can invoke the private function).
create or replace function public.create_category(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_sort_order integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_category(
    p_organization_id, p_name, p_description, p_sort_order
  );
end;
$$;

revoke all on function public.create_category(uuid, text, text, integer) from public, anon;
grant execute on function public.create_category(uuid, text, text, integer) to authenticated;

-- ============================================================================
-- 7. RPC: private.update_category
-- ============================================================================

create or replace function private.update_category(
  p_category_id uuid,
  p_name text,
  p_description text,
  p_sort_order integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_name text;
  v_old_description text;
  v_old_sort_order integer;
  v_changed_columns text[];
begin
  -- Lock the category row and resolve its organization.
  select c.organization_id, c.name, c.description, c.sort_order
  into v_organization_id, v_old_name, v_old_description, v_old_sort_order
  from public.categories c
  where c.id = p_category_id
  for update of c;

  if not found then
    raise exception 'Category not found';
  end if;

  -- Verify caller is an active member of the category's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has categories.manage permission in this organization.
  if not private.has_permission(v_organization_id, 'categories.manage') then
    raise exception 'Caller does not have category management permission in this organization';
  end if;

  -- Validate name.
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 120 then
    raise exception 'Category name must be between 2 and 120 characters';
  end if;

  -- Validate description.
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'Category description must be at most 1000 characters';
  end if;

  -- Validate sort order.
  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'Sort order must be zero or greater';
  end if;

  -- Detect changed columns for audit.
  if v_old_name is distinct from trim(p_name) then
    v_changed_columns := array_append(v_changed_columns, 'name');
  end if;
  if v_old_description is distinct from nullif(trim(p_description), '') then
    v_changed_columns := array_append(v_changed_columns, 'description');
  end if;
  if v_old_sort_order is distinct from p_sort_order then
    v_changed_columns := array_append(v_changed_columns, 'sort_order');
  end if;

  -- Update the category.
  update public.categories
  set name = trim(p_name),
      description = nullif(trim(p_description), ''),
      sort_order = p_sort_order,
      updated_at = now()
  where id = p_category_id;

  -- Audit log: category.updated (only if something changed).
  if v_changed_columns is not null then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      v_organization_id,
      auth.uid(),
      'category.updated',
      'category',
      p_category_id,
      jsonb_build_object('changed_columns', v_changed_columns),
      now()
    );
  end if;
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.update_category(uuid, text, text, integer) from public, anon, authenticated;

-- Public wrapper: update_category (SECURITY DEFINER so it can invoke the private function).
create or replace function public.update_category(
  p_category_id uuid,
  p_name text,
  p_description text,
  p_sort_order integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.update_category(
    p_category_id, p_name, p_description, p_sort_order
  );
end;
$$;

revoke all on function public.update_category(uuid, text, text, integer) from public, anon;
grant execute on function public.update_category(uuid, text, text, integer) to authenticated;

-- ============================================================================
-- 8. RPC: private.archive_category
-- ============================================================================

create or replace function private.archive_category(
  p_category_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_status text;
begin
  -- Lock the category row and resolve its organization.
  select c.organization_id, c.status
  into v_organization_id, v_old_status
  from public.categories c
  where c.id = p_category_id
  for update of c;

  if not found then
    raise exception 'Category not found';
  end if;

  -- Verify caller is an active member of the category's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has categories.manage permission in this organization.
  if not private.has_permission(v_organization_id, 'categories.manage') then
    raise exception 'Caller does not have category management permission in this organization';
  end if;

  -- Already archived: no-op so repeated clicks do not duplicate audit events.
  if v_old_status = 'inactive' then
    return;
  end if;

  -- Archive: set status to inactive.
  update public.categories
  set status = 'inactive',
      updated_at = now()
  where id = p_category_id;

  -- Audit log: category.archived
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'category.archived',
    'category',
    p_category_id,
    jsonb_build_object('status', 'inactive'),
    now()
  );
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.archive_category(uuid) from public, anon, authenticated;

-- Public wrapper: archive_category (SECURITY DEFINER so it can invoke the private function).
create or replace function public.archive_category(
  p_category_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.archive_category(p_category_id);
end;
$$;

revoke all on function public.archive_category(uuid) from public, anon;
grant execute on function public.archive_category(uuid) to authenticated;

commit;
