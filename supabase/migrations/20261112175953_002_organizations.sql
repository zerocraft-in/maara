-- ============================================================================
-- Migration 002: Organizations
-- Phase 2 — Authentication + Multi-tenancy foundation
-- ============================================================================

create table public.organizations (
  id uuid not null default gen_random_uuid() primary key,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  currency char(3) not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  country char(2) not null default 'IN',
  gstin text null,
  address jsonb null,
  phone text null,
  email text null,
  logo_path text null,
  invoice_prefix text not null default 'INV-',
  invoice_next_number int not null default 1 check (invoice_next_number > 0),
  tax_inclusive_pricing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'Top-level tenant. Every business record is organization-scoped.';
comment on column public.organizations.slug is 'URL-safe unique identifier, lowercase [a-z0-9-].';
comment on column public.organizations.currency is 'ISO 4217 currency code. INR only in Phase 1.';
comment on column public.organizations.invoice_next_number is 'Monotonic counter for invoice numbering.';

-- ============================================================================
-- RLS on organizations
-- ============================================================================
alter table public.organizations enable row level security;

-- Members may view organizations they belong to.
create policy "organizations_select_member"
on public.organizations for select
to authenticated
using (
  id in (select private.current_org_ids())
);

-- Only users with settings.manage may update an organization they belong to.
create policy "organizations_update_settings_manage"
on public.organizations for update
to authenticated
using (
  id in (select private.authorized_org_ids('settings.manage'))
)
with check (
  id in (select private.authorized_org_ids('settings.manage'))
);

-- Delete blocked by default — owner RPC only.
create policy "organizations_delete_owner_rpc"
on public.organizations for delete
to authenticated
using (
  false
);

-- ============================================================================
-- Updated at trigger
-- ============================================================================
create or replace function public.updated_at_trigger()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at
before update on public.organizations
for each row
execute function public.updated_at_trigger();

-- Migration 002: creates organizations table with RLS. Insert allowed only for
-- users with no active membership (first-time onboarding). Update gated on
-- settings.manage permission. Delete blocked by default.
-- Note: organizations_insert_onboarding policy is defined in migration 003
-- because it references organization_members which is created there.