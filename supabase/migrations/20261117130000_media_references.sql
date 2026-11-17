-- ============================================================================
-- Migration: media_references
-- Phase 2 — Asset reference tracking
--
-- Creates public.media_references to track where each media asset is used
-- across the application (products, categories, brands, settings, etc.).
-- This enables reference counting, usage warnings, and safe deletion.
--
-- Depends on:
--   - public.media
--   - public.products
--   - public.categories
--   - public.organizations
--
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. Do not apply to production.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Table: public.media_references
-- ============================================================================

create table if not exists public.media_references (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  entity_type text not null check (char_length(trim(entity_type)) between 1 and 40),
  entity_id uuid not null,
  field_name text not null check (char_length(trim(field_name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_references_media_entity_key
    unique (media_id, entity_type, entity_id, field_name),
  constraint media_references_id_organization_id_key
    unique (id, organization_id)
);

create index if not exists idx_media_references_media_id on public.media_references(media_id);
create index if not exists idx_media_references_entity on public.media_references(entity_type, entity_id);
create index if not exists idx_media_references_org on public.media_references(organization_id);

-- ============================================================================
-- 2. Updated at trigger
-- ============================================================================

create trigger media_references_updated_at
  before update on public.media_references
  for each row
  execute function public.updated_at_trigger();

-- ============================================================================
-- 3. RLS
-- ============================================================================

alter table public.media_references enable row level security;

create policy "media_references_select_member"
  on public.media_references for select
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('media.view'))
  );

create policy "media_references_insert_manage"
  on public.media_references for insert
  to authenticated
  with check (
    organization_id in (select private.authorized_org_ids('media.create'))
  );

create policy "media_references_update_manage"
  on public.media_references for update
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('media.update'))
  )
  with check (
    organization_id in (select private.authorized_org_ids('media.update'))
  );

create policy "media_references_delete_manage"
  on public.media_references for delete
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('media.delete'))
  );

-- ============================================================================
-- 4. Comments
-- ============================================================================

comment on table public.media_references is 'Tracks where each media asset is referenced across the application.';
comment on column public.media_references.entity_type is 'Entity type: product, category, brand, setting, etc.';
comment on column public.media_references.field_name is 'Field name on the entity: src, logo_path, image_src, etc.';

commit;
