-- ============================================================================
-- Migration 001: Extensions and common functions
-- Phase 2 — Authentication + Multi-tenancy foundation
-- ============================================================================

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
-- Schema: private
-- All security-critical helper functions live here.
-- USAGE on private is granted to authenticated so that public wrapper
-- functions (SECURITY INVOKER) can delegate to private SECURITY DEFINER
-- functions. EXECUTE on individual private functions remains restricted.
-- ============================================================================
create schema if not exists private;
grant usage on schema private to authenticated;
revoke all on schema private from public, anon;

-- ============================================================================
-- Helper: current_org_ids()
-- Returns the set of organization IDs the authenticated user is an active
-- member of. Used by RLS policies for tenant isolation.
-- ============================================================================
create or replace function private.current_org_ids()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and status = 'active';
end;
$$;

revoke all on function private.current_org_ids() from public, anon;
grant execute on function private.current_org_ids() to authenticated;

-- ============================================================================
-- Helper: authorized_org_ids(permission)
-- Returns organization IDs where the caller holds a given permission.
-- ============================================================================
create or replace function private.authorized_org_ids(p_permission text)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select om.organization_id
  from public.organization_members om
  join public.role_permissions rp on rp.role_id = om.role_id
  join public.permissions p on p.key = rp.permission_key
  where om.user_id = auth.uid()
    and om.status = 'active'
    and p.key = p_permission;
end;
$$;

revoke all on function private.authorized_org_ids(text) from public, anon;
grant execute on function private.authorized_org_ids(text) to authenticated;

-- ============================================================================
-- Helper: has_permission(org, permission)
-- Boolean check used inside RPC bodies and policy WITH CHECK clauses.
-- ============================================================================
create or replace function private.has_permission(p_org uuid, p_permission text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  select count(*)
  into v_count
  from public.organization_members om
  join public.role_permissions rp on rp.role_id = om.role_id
  join public.permissions p on p.key = rp.permission_key
  where om.user_id = auth.uid()
    and om.organization_id = p_org
    and om.status = 'active'
    and p.key = p_permission;

  return v_count > 0;
end;
$$;

revoke all on function private.has_permission(uuid, text) from public, anon;
grant execute on function private.has_permission(uuid, text) to authenticated;

-- ============================================================================
-- Helper: is_member(org)
-- Membership check without permission requirement.
-- ============================================================================
create or replace function private.is_member(p_org uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  select count(*)
  into v_count
  from public.organization_members
  where user_id = auth.uid()
    and organization_id = p_org
    and status = 'active';

  return v_count > 0;
end;
$$;

revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;

-- Migration 001: enables pgcrypto and citext extensions, creates private
-- schema, helper functions for tenant isolation and permission checks.