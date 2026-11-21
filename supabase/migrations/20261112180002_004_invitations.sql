-- ============================================================================
-- Migration 004: Invitations
-- Phase 2 — Authentication + Multi-tenancy foundation
-- ============================================================================

create table public.invitations (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email citext not null,
  role_id uuid not null references public.roles(id),
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invitations is 'Single-use, time-bound invitations bound to email.';
comment on column public.invitations.token_hash is 'Hashed invitation token - never stored in plaintext.';

-- ============================================================================
-- Indexes
-- ============================================================================
create index idx_invitations_org_email on public.invitations(organization_id, email);
create index idx_invitations_token_hash on public.invitations(token_hash);
create index idx_invitations_expires_at on public.invitations(expires_at);

-- Partial unique index: one pending invitation per email per organization.
-- Allows re-invitation after acceptance, revocation, or expiry.
create unique index idx_invitations_pending_org_email
on public.invitations(organization_id, email)
where accepted_at is null and revoked_at is null;

-- ============================================================================
-- Table-level grants: revoke direct DML from authenticated on invitations.
-- Only SECURITY DEFINER invite_member can INSERT.
-- Only SECURITY DEFINER accept_invitation can UPDATE accepted_at.
-- Only invite_member can set revoked_at.
-- ============================================================================
revoke insert on public.invitations from authenticated;
revoke update on public.invitations from authenticated;

-- Column-level grants: revoke UPDATE on accepted_at and revoked_at from
-- authenticated. Only SECURITY DEFINER accept_invitation can set accepted_at.
-- Only authorized invitation-management flow can set revoked_at.
-- ============================================================================
revoke update (accepted_at, revoked_at) on public.invitations from authenticated;

-- ============================================================================
-- RLS on invitations
-- ============================================================================
alter table public.invitations enable row level security;

-- Members can view invitations in their organizations.
create policy "invitations_select_member"
on public.invitations for select
to authenticated
using (
  organization_id in (select private.current_org_ids())
);

-- Create invitations only via users.invite permission.
create policy "invitations_insert_manage"
on public.invitations for insert
to authenticated
with check (
  organization_id in (select private.authorized_org_ids('users.invite'))
  and invited_by = (select id from public.profiles where id = auth.uid())
);

-- Update invitations: only revocation allowed, by users.manage_roles.
-- Acceptance is handled exclusively by private.accept_invitation RPC.
-- Column-level revoke prevents direct accepted_at/revoked_at changes.
create policy "invitations_update_manage"
on public.invitations for update
to authenticated
using (
  organization_id in (select private.authorized_org_ids('users.manage_roles'))
)
with check (
  organization_id in (select private.authorized_org_ids('users.manage_roles'))
);

-- Delete blocked by default — revocation via update only.
create policy "invitations_delete_manage"
on public.invitations for delete
to authenticated
using (false);

-- ============================================================================
-- Trigger: protect invitation immutable fields from direct update
-- SECURITY INVOKER (default). Runs for all updaters including SECURITY DEFINER
-- accept_invitation. Does NOT block accepted_at changes (accept_invitation
-- must set it). Blocks email, role_id, token_hash, invited_by, organization_id,
-- and un-revoking.
-- ============================================================================
create or replace function public.protect_invitations_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.email <> old.email then
    raise exception 'email cannot be changed';
  end if;
  if new.role_id <> old.role_id then
    raise exception 'role_id cannot be changed';
  end if;
  if new.token_hash <> old.token_hash then
    raise exception 'token_hash cannot be changed';
  end if;
  if new.invited_by <> old.invited_by then
    raise exception 'invited_by cannot be changed';
  end if;
  if new.organization_id <> old.organization_id then
    raise exception 'organization_id cannot be changed';
  end if;
  -- Cannot un-revoke.
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'cannot un-revoke an invitation';
  end if;
  return new;
end;
$$;

create trigger invitations_protect_immutable
before update on public.invitations
for each row
execute function public.protect_invitations_immutable();

-- ============================================================================
-- RPC: private.accept_invitation
-- Atomic, single-use acceptance. Locks the invitation row, validates token
-- hash, email match, expiry, and revocation, then creates/activates
-- membership. SECURITY DEFINER so it bypasses column-level grants and RLS
-- to set accepted_at.
-- ============================================================================
create or replace function private.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv_id uuid;
  v_org_id uuid;
  v_role_id uuid;
  v_profile_id uuid;
  v_caller_email text;
begin
  -- 1. Look up the invitation WITHOUT locking solely to identify its
  --    organization, so we can lock the organization row first (consistent
  --    lock order prevents deadlocks).
  select i.id, i.organization_id, i.role_id
  into v_inv_id, v_org_id, v_role_id
  from public.invitations i
  where i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now();

  if not found then
    raise exception 'Invalid or expired invitation';
  end if;

  -- 2. Lock the organization row first (consistent lock order).
  perform 1
  from public.organizations o
  where o.id = v_org_id
  for update of o;

  -- 3. Re-read and lock the invitation row with FOR UPDATE. Revalidate
  --    token, expiry, revocation, and accepted status after acquiring locks.
  select i.id, i.organization_id, i.role_id
  into v_inv_id, v_org_id, v_role_id
  from public.invitations i
  where i.id = v_inv_id
    and i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  for update of i;

  if not found then
    raise exception 'Invalid or expired invitation';
  end if;

  -- 4. Verify caller profile exists.
  select p.id into v_profile_id from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  -- 5. Case-insensitive email verification.
  select u.email into v_caller_email from auth.users u where u.id = auth.uid();
  if v_caller_email is null then
    raise exception 'Authenticated email not found';
  end if;

  if not exists (
    select 1 from public.invitations i2
    where i2.id = v_inv_id
      and lower(i2.email) = lower(v_caller_email)
  ) then
    raise exception 'Invitation email does not match your account';
  end if;

  -- 6. Prevent duplicate memberships: if the caller is already an active
  --    member of this organization, reject cleanly.
  if exists (
    select 1 from public.organization_members om
    where om.organization_id = v_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  ) then
    raise exception 'You are already a member of this organization';
  end if;

  -- 7. Atomic: mark accepted. SECURITY DEFINER bypasses column-level revoke
  --    on accepted_at.
  update public.invitations
  set accepted_at = now()
  where id = v_inv_id;

  -- 8. Create or activate membership. Role comes from the invitation (set by
  --    the inviter, not the invitee), so no role escalation is possible.
  --    Column-level revoke on organization_members.role_id/status does not
  --    apply here because this is SECURITY DEFINER.
  insert into public.organization_members
    (organization_id, user_id, role_id, status, joined_at)
  values (v_org_id, auth.uid(), v_role_id, 'active', now())
  on conflict (organization_id, user_id) do update
  set status = 'active',
      role_id = v_role_id,
      joined_at = now(),
      updated_at = now();

  return v_org_id;
end;
$$;

revoke all on function private.accept_invitation(text) from public, anon;
grant execute on function private.accept_invitation(text) to authenticated;

-- ============================================================================
-- Public wrapper: accept_invitation
-- SECURITY INVOKER — callable via PostgREST without exposing private schema.
-- Delegates to private.accept_invitation which performs all validation.
-- ============================================================================
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  return private.accept_invitation(p_token);
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- ============================================================================
-- Updated at trigger
-- ============================================================================
create trigger invitations_updated_at
before update on public.invitations
for each row
execute function public.updated_at_trigger();

-- Migration 004: creates invitations table with RLS. Tokens hashed with pgcrypto,
-- single-use with row locking, expiring, email-bound. Partial unique index
-- allows re-invitation after acceptance/revocation/expiry. Column-level UPDATE
-- revokes on accepted_at/revoked_at prevent direct writes. Acceptance exclusively
-- via private.accept_invitation SECURITY DEFINER RPC.