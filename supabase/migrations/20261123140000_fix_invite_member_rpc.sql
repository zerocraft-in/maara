-- Fix invite_member RPC contract mismatch.
--
-- Problem: The application calls `invite_member` with (p_actor_user_id,
-- p_organization_id, p_email, p_role_key) and expects {invitation_id, token}
-- back. The existing database function accepts
-- (p_organization_id, p_email, p_role_key) and returns only a uuid.
--
-- This migration:
-- 1. Adds p_actor_user_id parameter to private.invite_member.
-- 2. Changes return type to jsonb {invitation_id, token}.
-- 3. Returns the plaintext token only to the authenticated actor who created it.
-- 4. Adds cancel_invitation RPC (referenced by actions.ts but missing).
-- 5. Does NOT duplicate audit logging: the existing audit_invitation_create
--    trigger on public.invitations already logs 'member.invited' on INSERT.
-- 6. Keeps existing invitations intact (no schema changes to invitations table).

begin;

-- ---------------------------------------------------------------------------
-- Update invite_member: accept actor user id, return invitation_id + token.
-- ---------------------------------------------------------------------------

create or replace function private.invite_member(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_email text,
  p_role_key text
) returns jsonb
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
  -- 1. Actor must be authenticated (enforced by auth.uid() being non-null).
  if auth.uid() is null then
    raise exception 'Actor must be authenticated';
  end if;

  -- 2. The actor user id must match the authenticated user (never trust client).
  if p_actor_user_id <> auth.uid() then
    raise exception 'Actor user id does not match authenticated user';
  end if;

  -- 3. Lock the organization row first (consistent lock order).
  perform 1
  from public.organizations o
  where o.id = p_organization_id
  for update of o;

  -- 4. Verify caller is an active member of the target organization (locked).
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

  -- 5. Verify caller has users.invite permission.
  if not private.has_permission(p_organization_id, 'users.invite') then
    raise exception 'Caller does not have invitation permission';
  end if;

  -- 6. Resolve target role.
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

  -- 7. Generate secure random token.
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Revoke any existing pending invitation for this email in this org.
  update public.invitations
  set revoked_at = now()
  where organization_id = p_organization_id
    and lower(email) = lower(p_email)
    and accepted_at is null
    and revoked_at is null;

  -- Insert the invitation. (Audit trigger audit_invitation_create fires
  -- automatically on INSERT and logs 'member.invited'.)
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

  -- 8. Return invitation_id and plaintext token to the actor only.
  return jsonb_build_object(
    'invitation_id', v_inv_id,
    'token', v_token
  );
end;
$$;

revoke all on function private.invite_member(uuid, uuid, text, text) from public, anon;
grant execute on function private.invite_member(uuid, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Add cancel_invitation RPC (referenced by actions.ts but was missing).
-- Revokes a pending invitation. Only the inviter or a users.manage_roles
-- member of the same organization can cancel.
-- ---------------------------------------------------------------------------

create or replace function private.cancel_invitation(
  p_actor_user_id uuid,
  p_invitation_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv_org_id uuid;
  v_invited_by uuid;
begin
  if auth.uid() is null then
    raise exception 'Actor must be authenticated';
  end if;

  if p_actor_user_id <> auth.uid() then
    raise exception 'Actor user id does not match authenticated user';
  end if;

  -- Load the invitation and its organization.
  select i.organization_id, i.invited_by
  into v_inv_org_id, v_invited_by
  from public.invitations i
  where i.id = p_invitation_id
    and i.accepted_at is null
    and i.revoked_at is null;

  if not found then
    raise exception 'Invitation not found or already consumed';
  end if;

  -- Actor must be the inviter OR have users.manage_roles in the org.
  if v_invited_by <> (select id from public.profiles where id = auth.uid()) then
    -- Not the inviter: require users.manage_roles permission in the org.
    perform 1
    from public.organization_members om
    join public.roles r on r.id = om.role_id
    where om.organization_id = v_inv_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
    for update of om;

    if not found then
      raise exception 'Caller is not an active member of this organization';
    end if;

    if not private.has_permission(v_inv_org_id, 'users.manage_roles') then
      raise exception 'Caller does not have permission to cancel invitations';
    end if;
  end if;

  -- Revoke the invitation.
  update public.invitations
  set revoked_at = now()
  where id = p_invitation_id;
end;
$$;

revoke all on function private.cancel_invitation(uuid, uuid) from public, anon;
grant execute on function private.cancel_invitation(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public wrapper for cancel_invitation (SECURITY INVOKER).
-- ---------------------------------------------------------------------------

create or replace function public.cancel_invitation(
  p_actor_user_id uuid,
  p_invitation_id uuid
) returns void
language plpgsql
set search_path = ''
as $$
begin
  return private.cancel_invitation(p_actor_user_id, p_invitation_id);
end;
$$;

revoke all on function public.cancel_invitation(uuid, uuid) from public, anon;
grant execute on function public.cancel_invitation(uuid, uuid) to authenticated;

commit;

-- Migration: fixes invite_member contract to accept p_actor_user_id and
-- return {invitation_id, token}. Adds cancel_invitation RPC.
-- Existing invitations are preserved; no table schema changes.
-- Audit logging for invitation creation is handled by the existing
-- audit_invitation_create trigger (fires on INSERT into public.invitations).
