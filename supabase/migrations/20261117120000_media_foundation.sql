-- ============================================================================
-- Migration: media_foundation
-- Phase 2 — Media files database foundation (Cloudflare R2)
--
-- Creates public.media with organization-scoped RLS, SECURITY DEFINER RPCs
-- for all writes, and audit log events. File bytes live in Cloudflare R2;
-- this table tracks metadata (key, name, content_type, size, public URL).
--
-- Depends on:
--   - public.organizations
--   - private.authorized_org_ids / private.has_permission / private.is_member
--
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. Do not apply to production.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Table: public.media
-- ============================================================================

create table public.media (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null check (char_length(trim(key)) between 1 and 1024),
  name text not null check (char_length(trim(name)) between 1 and 255),
  content_type text null check (content_type is null or char_length(content_type) <= 200),
  size_bytes bigint not null check (size_bytes >= 0),
  url text not null check (char_length(trim(url)) between 1 and 2048),
  uploaded_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_id_organization_id_key unique (id, organization_id)
);

comment on table public.media is 'Media file metadata. File bytes live in Cloudflare R2; this table tracks key, name, content type, size and public URL.';
comment on column public.media.key is 'R2 object key, organization-scoped prefix: {organizationId}/{uuid}-{filename}.';
comment on column public.media.url is 'Public URL served via the R2 custom domain (e.g. https://media.maara.co.in/{key}).';

-- ============================================================================
-- 2. Indexes on public.media
-- ============================================================================

create index idx_media_org_id on public.media(organization_id);
create index idx_media_org_created on public.media(organization_id, created_at desc);
create index idx_media_org_name on public.media(organization_id, name);

-- ============================================================================
-- 3. Updated at trigger on public.media
-- ============================================================================

create trigger media_updated_at
  before update on public.media
  for each row
  execute function public.updated_at_trigger();

-- ============================================================================
-- 4. Table-level grants: revoke direct DML from authenticated
-- ============================================================================

REVOKE ALL ON TABLE public.media FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.media TO authenticated;

-- ============================================================================
-- 5. RLS on public.media
-- ============================================================================

alter table public.media enable row level security;

create policy "media_select_member"
  on public.media for select
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('media.view'))
  );

create policy "media_insert_create"
  on public.media for insert
  to authenticated
  with check (
    organization_id in (select private.authorized_org_ids('media.create'))
  );

create policy "media_update_manage"
  on public.media for update
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('media.update'))
  )
  with check (
    organization_id in (select private.authorized_org_ids('media.update'))
  );

create policy "media_delete_manage"
  on public.media for delete
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('media.delete'))
  );

-- ============================================================================
-- 6. Permission catalogue entries
-- ============================================================================

insert into public.permissions (key, "group", description) values
  ('media.view', 'Content', 'View media files in the media manager'),
  ('media.create', 'Content', 'Upload new media files to R2'),
  ('media.update', 'Content', 'Rename media files'),
  ('media.delete', 'Content', 'Delete media files from R2')
on conflict (key) do nothing;

-- Grant media permissions to owner, admin, manager roles.
insert into public.role_permissions (role_id, permission_key)
  select r.id, p.key
  from public.roles r
  cross join public.permissions p
  where r.key in ('owner', 'admin', 'manager')
    and p.key like 'media.%'
on conflict do nothing;

-- ============================================================================
-- 7. RPC: private.create_media
-- ============================================================================

create or replace function private.create_media(
  p_organization_id uuid,
  p_key text,
  p_name text,
  p_content_type text,
  p_size_bytes bigint,
  p_url text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_id uuid;
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
  if not private.is_member(p_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has media.create permission in this organization.
  if not private.has_permission(p_organization_id, 'media.create') then
    raise exception 'Caller does not have media creation permission in this organization';
  end if;

  -- Validate name.
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 255 then
    raise exception 'Media name must be between 1 and 255 characters';
  end if;

  -- Validate key.
  if p_key is null or char_length(trim(p_key)) < 1 or char_length(trim(p_key)) > 1024 then
    raise exception 'Media key must be between 1 and 1024 characters';
  end if;

  -- Validate size.
  if p_size_bytes is null or p_size_bytes < 0 then
    raise exception 'Media size must be zero or greater';
  end if;

  -- Validate URL.
  if p_url is null or char_length(trim(p_url)) < 1 or char_length(trim(p_url)) > 2048 then
    raise exception 'Media URL must be between 1 and 2048 characters';
  end if;

  insert into public.media
    (organization_id, key, name, content_type, size_bytes, url, uploaded_by)
  values (
    p_organization_id,
    trim(p_key),
    trim(p_name),
    nullif(trim(p_content_type), ''),
    p_size_bytes,
    trim(p_url),
    auth.uid()
  )
  returning id into v_media_id;

  -- Audit log: media.created
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    p_organization_id,
    auth.uid(),
    'media.created',
    'media',
    v_media_id,
    jsonb_build_object(
      'key', trim(p_key),
      'name', trim(p_name),
      'content_type', nullif(trim(p_content_type), ''),
      'size_bytes', p_size_bytes
    ),
    now()
  );

  return v_media_id;
end;
$$;

revoke all on function private.create_media(uuid, text, text, text, bigint, text) from public, anon, authenticated;

create or replace function public.create_media(
  p_organization_id uuid,
  p_key text,
  p_name text,
  p_content_type text,
  p_size_bytes bigint,
  p_url text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_media(
    p_organization_id, p_key, p_name, p_content_type, p_size_bytes, p_url
  );
end;
$$;

revoke all on function public.create_media(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.create_media(uuid, text, text, text, bigint, text) to authenticated;

-- ============================================================================
-- 8. RPC: private.update_media
-- ============================================================================

create or replace function private.update_media(
  p_media_id uuid,
  p_name text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_name text;
  v_changed_columns text[];
begin
  -- Lock the media row and resolve its organization.
  select m.organization_id, m.name
  into v_organization_id, v_old_name
  from public.media m
  where m.id = p_media_id
  for update of m;

  if not found then
    raise exception 'Media not found';
  end if;

  -- Verify caller is an active member of the media's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has media.update permission in this organization.
  if not private.has_permission(v_organization_id, 'media.update') then
    raise exception 'Caller does not have media update permission in this organization';
  end if;

  -- Validate name.
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 255 then
    raise exception 'Media name must be between 1 and 255 characters';
  end if;

  if v_old_name is distinct from trim(p_name) then
    v_changed_columns := array_append(v_changed_columns, 'name');
  end if;

  update public.media
  set name = trim(p_name),
      updated_at = now()
  where id = p_media_id;

  -- Audit log: media.updated (only if something changed).
  if v_changed_columns is not null then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      v_organization_id,
      auth.uid(),
      'media.updated',
      'media',
      p_media_id,
      jsonb_build_object('changed_columns', v_changed_columns),
      now()
    );
  end if;
end;
$$;

revoke all on function private.update_media(uuid, text) from public, anon, authenticated;

create or replace function public.update_media(
  p_media_id uuid,
  p_name text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.update_media(p_media_id, p_name);
end;
$$;

revoke all on function public.update_media(uuid, text) from public, anon;
grant execute on function public.update_media(uuid, text) to authenticated;

-- ============================================================================
-- 9. RPC: private.delete_media
-- ============================================================================

create or replace function private.delete_media(
  p_media_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  -- Lock the media row and resolve its organization.
  select m.organization_id
  into v_organization_id
  from public.media m
  where m.id = p_media_id
  for update of m;

  if not found then
    raise exception 'Media not found';
  end if;

  -- Verify caller is an active member of the media's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has media.delete permission in this organization.
  if not private.has_permission(v_organization_id, 'media.delete') then
    raise exception 'Caller does not have media delete permission in this organization';
  end if;

  delete from public.media
  where id = p_media_id;

  -- Audit log: media.deleted
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'media.deleted',
    'media',
    p_media_id,
    jsonb_build_object('deleted', true),
    now()
  );
end;
$$;

revoke all on function private.delete_media(uuid) from public, anon, authenticated;

create or replace function public.delete_media(
  p_media_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.delete_media(p_media_id);
end;
$$;

revoke all on function public.delete_media(uuid) from public, anon;
grant execute on function public.delete_media(uuid) to authenticated;

commit;
