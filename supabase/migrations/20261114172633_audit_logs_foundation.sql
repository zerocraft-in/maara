-- ============================================================================
-- Migration: audit_logs_foundation
-- Phase 2 — Audit logging foundation
--
-- Creates an append-only public.audit_logs table for organization-scoped
-- audit events. All writes happen exclusively through SECURITY DEFINER
-- database triggers; there is no client-callable audit writer RPC.
--
-- This migration is forward-only and idempotent at the "do not error on
-- re-run" level. It does not modify or drop any historical migration.
--
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. Do not apply to production.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Extensions (idempotent; pgcrypto provides gen_random_uuid())
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- 2. Table: public.audit_logs
-- ============================================================================
create table if not exists public.audit_logs (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only audit log. Rows are written exclusively by SECURITY DEFINER '
  'database triggers; clients can only SELECT.';

comment on column public.audit_logs.organization_id is
  'Organization the event belongs to. Tenant isolation boundary.';
comment on column public.audit_logs.actor_user_id is
  'User who caused the event. Null for system-triggered events.';
comment on column public.audit_logs.action is
  'Stable event key, e.g. organization.settings_changed, member.invited.';
comment on column public.audit_logs.entity_type is
  'Type of entity the event concerns, e.g. organization, invitation, member.';
comment on column public.audit_logs.entity_id is
  'Primary key of the affected entity, when applicable.';
comment on column public.audit_logs.metadata is
  'Structured event context. Never contains passwords, tokens, or secrets.';
comment on column public.audit_logs.created_at is
  'Event timestamp. Never updated after insert.';

-- ============================================================================
-- 3. Indexes
-- ============================================================================
create index if not exists idx_audit_logs_org_created_at
  on public.audit_logs(organization_id, created_at desc);

create index if not exists idx_audit_logs_action
  on public.audit_logs(action);

-- ============================================================================
-- 4. RLS
-- ============================================================================
alter table public.audit_logs enable row level security;

-- SELECT only: authenticated users with audit_logs.view in the exact org.
drop policy if exists "audit_logs_select_view_permission"
  on public.audit_logs;

create policy "audit_logs_select_view_permission"
on public.audit_logs for select
to authenticated
using (
  organization_id in (select private.authorized_org_ids('audit_logs.view'))
);

-- No INSERT, UPDATE, DELETE policies for authenticated: defaults to deny.
-- No policy for anon: defaults to deny.

-- ============================================================================
-- 5. Grants
-- ============================================================================
-- Revoke everything from public, anon, authenticated, and service_role so no
-- role can write directly. Only SECURITY DEFINER triggers insert into this
-- table, bypassing table-level grants but not RLS (which permits SELECT only).
revoke all on table public.audit_logs from public, anon, authenticated, service_role;

-- Explicitly grant only SELECT for the Supabase Data API.
grant select on public.audit_logs to authenticated;

-- ============================================================================
-- 6. Trigger functions (private schema, SECURITY DEFINER)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 Organization settings changes
-- Fires BEFORE UPDATE on public.organizations. Logs only when at least one
-- relevant settings column actually changes. Actor = auth.uid().
-- ----------------------------------------------------------------------------
create or replace function private.audit_organization_settings_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed_columns text[];
begin
  if (old.name is distinct from new.name)
     or (old.timezone is distinct from new.timezone)
     or (old.gstin is distinct from new.gstin)
     or (old.phone is distinct from new.phone)
     or (old.email is distinct from new.email)
     or (old.invoice_prefix is distinct from new.invoice_prefix)
     or (old.tax_inclusive_pricing is distinct from new.tax_inclusive_pricing) then

    if old.name is distinct from new.name then
      v_changed_columns := array_append(v_changed_columns, 'name');
    end if;
    if old.timezone is distinct from new.timezone then
      v_changed_columns := array_append(v_changed_columns, 'timezone');
    end if;
    if old.gstin is distinct from new.gstin then
      v_changed_columns := array_append(v_changed_columns, 'gstin');
    end if;
    if old.phone is distinct from new.phone then
      v_changed_columns := array_append(v_changed_columns, 'phone');
    end if;
    if old.email is distinct from new.email then
      v_changed_columns := array_append(v_changed_columns, 'email');
    end if;
    if old.invoice_prefix is distinct from new.invoice_prefix then
      v_changed_columns := array_append(v_changed_columns, 'invoice_prefix');
    end if;
    if old.tax_inclusive_pricing is distinct from new.tax_inclusive_pricing then
      v_changed_columns := array_append(v_changed_columns, 'tax_inclusive_pricing');
    end if;

    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      old.id,
      auth.uid(),
      'organization.settings_changed',
      'organization',
      old.id,
      jsonb_build_object('changed_columns', v_changed_columns),
      now()
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_organization_settings_update() from public, anon, authenticated;

drop trigger if exists audit_organization_settings_update
  on public.organizations;

create trigger audit_organization_settings_update
before update on public.organizations
for each row
execute function private.audit_organization_settings_update();

-- ----------------------------------------------------------------------------
-- 6.2 Invitation creation
-- Fires AFTER INSERT on public.invitations. Logs member.invited using the
-- invitation's invited_by as actor. Never records token or token_hash.
-- ----------------------------------------------------------------------------
create or replace function private.audit_invitation_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_key text;
begin
  select r.key into v_role_key
  from public.roles r
  where r.id = new.role_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    new.organization_id,
    new.invited_by,
    'member.invited',
    'invitation',
    new.id,
    jsonb_build_object(
      'email', new.email,
      'role_key', v_role_key
    ),
    now()
  );

  return new;
end;
$$;

revoke all on function private.audit_invitation_create() from public, anon, authenticated;

drop trigger if exists audit_invitation_create
  on public.invitations;

create trigger audit_invitation_create
after insert on public.invitations
for each row
execute function private.audit_invitation_create();

-- ----------------------------------------------------------------------------
-- 6.3 Invitation acceptance
-- Fires AFTER UPDATE on public.invitations. Logs invitation.accepted using
-- auth.uid(), only when accepted_at transitions from NULL to a value.
-- ----------------------------------------------------------------------------
create or replace function private.audit_invitation_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.accepted_at is null and new.accepted_at is not null then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      new.organization_id,
      auth.uid(),
      'invitation.accepted',
      'invitation',
      new.id,
      jsonb_build_object('email', new.email),
      now()
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_invitation_accept() from public, anon, authenticated;

drop trigger if exists audit_invitation_accept
  on public.invitations;

create trigger audit_invitation_accept
after update on public.invitations
for each row
execute function private.audit_invitation_accept();

-- ----------------------------------------------------------------------------
-- 6.4 Member role changes
-- Fires AFTER UPDATE on public.organization_members. Logs member.role_changed
-- only when role_id changes. Resolves old and new role keys safely. Actor =
-- auth.uid().
-- ----------------------------------------------------------------------------
create or replace function private.audit_member_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_role_key text;
  v_new_role_key text;
begin
  if old.role_id is distinct from new.role_id then
    select r.key into v_old_role_key
    from public.roles r
    where r.id = old.role_id;

    select r.key into v_new_role_key
    from public.roles r
    where r.id = new.role_id;

    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      new.organization_id,
      auth.uid(),
      'member.role_changed',
      'member',
      new.id,
      jsonb_build_object(
        'user_id', new.user_id,
        'old_role_key', v_old_role_key,
        'new_role_key', v_new_role_key
      ),
      now()
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_member_role_change() from public, anon, authenticated;

drop trigger if exists audit_member_role_change
  on public.organization_members;

create trigger audit_member_role_change
after update on public.organization_members
for each row
execute function private.audit_member_role_change();

-- ============================================================================
-- 7. Invitation cancellation — deferred
-- ============================================================================
--
-- The cancel_invitation RPC is invoked from server code with p_actor_user_id
-- and p_invitation_id, but its SQL body is NOT present in any migration in
-- this repository (it is deployed separately to the database). Because the
-- task requires preserving the existing RPC's exact validation and locking
-- behavior, cancellation logging is intentionally NOT implemented here.
--
-- If the RPC body is later added to a migration, a trigger or RPC-internal
-- INSERT into public.audit_logs (action 'invitation.cancelled') can be added
-- then, using p_actor_user_id as the actor and never recording token/token_hash.

commit;
