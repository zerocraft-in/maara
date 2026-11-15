-- ============================================================================
-- Migration: category_status_rpc
-- Phase 2 — Categories status changes
--
-- Adds a dedicated RPC for changing category status (archive / reactivate).
-- The original categories_foundation migration remains unchanged and must not
-- be reapplied.
--
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. Do not apply to production.
-- ============================================================================

begin;

-- ============================================================================
-- 1. RPC: private.set_category_status
-- ============================================================================

create or replace function private.set_category_status(
  p_category_id uuid,
  p_status text
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

  -- Validate the requested status.
  if p_status is null or p_status not in ('active', 'inactive') then
    raise exception 'Category status must be active or inactive';
  end if;

  -- No-op when the status is already the requested value.
  if v_old_status = p_status then
    return;
  end if;

  update public.categories
  set status = p_status,
      updated_at = now()
  where id = p_category_id;

  -- Audit log: category.status_changed
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'category.status_changed',
    'category',
    p_category_id,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_status
    ),
    now()
  );
end;
$$;

-- Keep private function EXECUTE revoked from authenticated; only public wrapper is executable.
revoke all on function private.set_category_status(uuid, text) from public, anon, authenticated;

-- Public wrapper: set_category_status (SECURITY DEFINER so it can invoke the private function).
create or replace function public.set_category_status(
  p_category_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.set_category_status(p_category_id, p_status);
end;
$$;

revoke all on function public.set_category_status(uuid, text) from public, anon;
grant execute on function public.set_category_status(uuid, text) to authenticated;

commit;
