-- Normalize catalog names and add a Shopify-shaped customer aggregate.
-- This migration is intentionally additive/rename-only for existing data.

begin;

-- Shopify taxonomy is the canonical product category table in this project.
do $$
begin
  if to_regclass('public.shopify_product_categories') is not null
     and to_regclass('public.categories') is not null
     and to_regclass('public.store_categories') is null then
    alter table public.categories rename to store_categories;
  end if;
  if to_regclass('public.shopify_product_categories') is not null
     and to_regclass('public.categories') is null then
    alter table public.shopify_product_categories rename to categories;
  end if;
end
$$;

-- Keep the collection catalog in `collections`; rename only the join table.
do $$
begin
  if to_regclass('public.product_collections') is not null
     and to_regclass('public.collection_products') is null then
    alter table public.product_collections rename to collection_products;
  end if;
end
$$;

-- Publications are product/channel state, not channels themselves.
do $$
begin
  if to_regclass('public.product_channel_publications') is not null
     and to_regclass('public.product_publications') is null then
    alter table public.product_channel_publications rename to product_publications;
  end if;
end
$$;

-- A user's location assignments are not locations. Preserve that relationship
-- under a precise name before removing the ambiguous table name.
do $$
begin
  if to_regclass('public.user_locations') is not null
     and to_regclass('public.location_user_assignments') is null then
    alter table public.user_locations rename to location_user_assignments;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.location_user_assignments') is not null
     and exists (select 1 from pg_constraint where conname = 'fk_user_locations_member') then
    alter table public.location_user_assignments rename constraint fk_user_locations_member to fk_location_user_assignments_member;
  end if;
  if to_regclass('public.location_user_assignments') is not null
     and exists (select 1 from pg_constraint where conname = 'fk_user_locations_location') then
    alter table public.location_user_assignments rename constraint fk_user_locations_location to fk_location_user_assignments_location;
  end if;
end
$$;

-- Existing location RPCs were deployed before the table rename and still use
-- the old relation name. This compatibility view is not a table and keeps
-- those SECURITY DEFINER RPCs working while clients move to the new name.
do $$
begin
  if to_regclass('public.location_user_assignments') is not null
     and to_regclass('public.user_locations') is null then
    execute $view$
      create view public.user_locations
      with (security_invoker = true)
      as select * from public.location_user_assignments
    $view$;
    execute $fn$
      create or replace function private.user_locations_compat_write()
      returns trigger
      language plpgsql
      security definer
      set search_path = public, pg_temp
      as $body$
      begin
        if tg_op = 'INSERT' then
          insert into public.location_user_assignments
            (id, organization_id, user_id, location_id, assigned_by, assigned_at, created_at, updated_at)
          values
            (new.id, new.organization_id, new.user_id, new.location_id, new.assigned_by, new.assigned_at, new.created_at, new.updated_at);
          return new;
        elsif tg_op = 'UPDATE' then
          update public.location_user_assignments
          set organization_id = new.organization_id,
              user_id = new.user_id,
              location_id = new.location_id,
              assigned_by = new.assigned_by,
              assigned_at = new.assigned_at,
              created_at = new.created_at,
              updated_at = new.updated_at
          where id = old.id;
          return new;
        elsif tg_op = 'DELETE' then
          delete from public.location_user_assignments where id = old.id;
          return old;
        end if;
        return null;
      end;
      $body$;
    $fn$;
    execute 'create trigger user_locations_compat_write instead of insert or update or delete on public.user_locations for each row execute function private.user_locations_compat_write()';
    execute 'comment on view public.user_locations is ''Compatibility view; use public.location_user_assignments.''';
    execute 'revoke all on public.user_locations from public, anon, authenticated';
    execute 'grant select on public.user_locations to authenticated';
  end if;
end
$$;

-- Shopify-style customer record. Addresses are JSONB so the model can retain
-- Shopify's address shape without coupling checkout implementation to this table.
create table if not exists public.customers (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text null,
  phone text null,
  first_name text null,
  last_name text null,
  note text null,
  tags text[] not null default '{}'::text[],
  tax_exempt boolean not null default false,
  accepts_marketing boolean not null default false,
  marketing_opt_in_level text not null default 'unknown'
    check (marketing_opt_in_level in ('unknown', 'single_opt_in', 'confirmed_opt_in', 'unconfirmed_opt_in')),
  state text not null default 'enabled'
    check (state in ('enabled', 'disabled', 'invited', 'declined')),
  verified_email boolean not null default false,
  default_address jsonb null,
  addresses jsonb not null default '[]'::jsonb,
  orders_count integer not null default 0 check (orders_count >= 0),
  total_spent numeric(14,2) not null default 0 check (total_spent >= 0),
  last_order_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_email_length check (email is null or char_length(email) <= 320),
  constraint customers_phone_length check (phone is null or char_length(phone) <= 32),
  constraint customers_addresses_array check (jsonb_typeof(addresses) = 'array'),
  constraint customers_default_address_object check (default_address is null or jsonb_typeof(default_address) = 'object')
);

create unique index if not exists customers_org_email_key
  on public.customers (organization_id, lower(email))
  where email is not null;
create index if not exists customers_org_name_idx
  on public.customers (organization_id, lower(last_name), lower(first_name));
create index if not exists customers_org_phone_idx
  on public.customers (organization_id, phone)
  where phone is not null;

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.updated_at_trigger();

comment on table public.customers is 'Organization-scoped Shopify-style customer profiles and aggregate order metrics.';
comment on column public.customers.default_address is 'Shopify-shaped default customer address JSON object.';
comment on column public.customers.addresses is 'Shopify-shaped customer address JSON array.';

alter table public.customers enable row level security;
revoke all on public.customers from public, anon, authenticated;
grant select on public.customers to authenticated;

drop policy if exists customers_select_member on public.customers;
create policy customers_select_member
  on public.customers for select to authenticated
  using (organization_id in (select private.authorized_org_ids('customers.view')));

drop policy if exists customers_insert_manage on public.customers;
create policy customers_insert_manage
  on public.customers for insert to authenticated
  with check (organization_id in (select private.authorized_org_ids('customers.manage')));

drop policy if exists customers_update_manage on public.customers;
create policy customers_update_manage
  on public.customers for update to authenticated
  using (organization_id in (select private.authorized_org_ids('customers.manage')))
  with check (organization_id in (select private.authorized_org_ids('customers.manage')));

drop policy if exists customers_delete_manage on public.customers;
create policy customers_delete_manage
  on public.customers for delete to authenticated
  using (organization_id in (select private.authorized_org_ids('customers.manage')));

commit;
