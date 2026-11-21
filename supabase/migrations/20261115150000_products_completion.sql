-- ============================================================================
-- Migration: products_completion
-- Phase 2 — Idempotent completion for products and product variants
--
-- Use this ONLY if 20261115140000_products_foundation.sql was applied
-- partially (for example public.products exists but public.product_variants
-- does not). Every statement here is safe to run against an existing,
-- partially-created schema:
--   * tables use IF NOT EXISTS
--   * indexes use IF NOT EXISTS
--   * triggers and policies are dropped before being recreated
--   * functions use CREATE OR REPLACE
--
-- Do NOT apply this before 20261115140000 on a fresh database unless that
-- migration failed; applying both in order is harmless.
--
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. Do not apply to production.
-- ============================================================================

begin;

-- ============================================================================
-- 0. Ensure the products unique key needed by the variant foreign key
-- ============================================================================

create table if not exists public.products (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text null check (description is null or char_length(description) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  is_tax_inclusive boolean not null default false,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_id_organization_id_key
    unique (id, organization_id),
  constraint products_category_fk
    foreign key (category_id, organization_id)
    references public.categories(id, organization_id)
    on delete restrict
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_id_organization_id_key'
  ) then
    alter table public.products
      add constraint products_id_organization_id_key unique (id, organization_id);
  end if;
end
$$;

comment on table public.products is 'Products, organization-scoped. Variants hold SKU and pricing.';
comment on column public.products.status is 'draft, active or archived. Archived products keep their variants for history.';
comment on column public.products.tax_rate_bps is 'Default tax rate in basis points (10000 = 100%). Variants may override.';

-- ============================================================================
-- 2. Indexes on public.products
-- ============================================================================

create index if not exists idx_products_org_id on public.products(organization_id);
create index if not exists idx_products_org_status on public.products(organization_id, status);
create index if not exists idx_products_org_category on public.products(organization_id, category_id);
create index if not exists idx_products_org_name on public.products(organization_id, name);

-- ============================================================================
-- 3. Updated at trigger on public.products
-- ============================================================================

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row
  execute function public.updated_at_trigger();

-- ============================================================================
-- 4. Table: public.product_variants
-- ============================================================================

create table if not exists public.product_variants (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  sku text not null check (sku ~ '^[A-Z0-9-]{2,40}$'),
  barcode text null check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  size text null check (size is null or char_length(size) <= 20),
  colour text null check (colour is null or char_length(colour) <= 40),
  cost_price_paise bigint not null default 0 check (cost_price_paise >= 0),
  selling_price_paise bigint not null default 0 check (selling_price_paise >= 0),
  tax_rate_bps integer null check (tax_rate_bps is null or tax_rate_bps between 0 and 10000),
  reorder_point integer not null default 0 check (reorder_point >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku),
  constraint product_variants_id_organization_id_key
    unique (id, organization_id),
  constraint product_variants_product_fk
    foreign key (product_id, organization_id)
    references public.products(id, organization_id)
    on delete restrict
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.product_variants'::regclass
      and conname = 'product_variants_organization_id_sku_key'
  ) then
    alter table public.product_variants
      add constraint product_variants_organization_id_sku_key
      unique (organization_id, sku);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.product_variants'::regclass
      and conname = 'product_variants_id_organization_id_key'
  ) then
    alter table public.product_variants
      add constraint product_variants_id_organization_id_key
      unique (id, organization_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.product_variants'::regclass
      and conname = 'product_variants_product_fk'
  ) then
    alter table public.product_variants
      add constraint product_variants_product_fk
      foreign key (product_id, organization_id)
      references public.products(id, organization_id)
      on delete restrict;
  end if;
end
$$;

comment on table public.product_variants is 'Sellable variants (size/colour) with SKU, barcode and pricing.';
comment on column public.product_variants.sku is 'Unique uppercase alphanumeric/hyphen SKU within an organization.';
comment on column public.product_variants.barcode is 'Optional 8-14 digit barcode, unique within an organization when present.';

-- ============================================================================
-- 5. Indexes on public.product_variants
-- ============================================================================

create index if not exists idx_product_variants_org_id on public.product_variants(organization_id);
create index if not exists idx_product_variants_org_product on public.product_variants(organization_id, product_id);
create index if not exists idx_product_variants_org_active on public.product_variants(organization_id, is_active);
create unique index if not exists idx_product_variants_org_barcode
  on public.product_variants(organization_id, barcode)
  where barcode is not null;

-- ============================================================================
-- 6. Updated at trigger on public.product_variants
-- ============================================================================

drop trigger if exists product_variants_updated_at on public.product_variants;
create trigger product_variants_updated_at
  before update on public.product_variants
  for each row
  execute function public.updated_at_trigger();

-- ============================================================================
-- 7. Table-level grants: revoke direct DML from authenticated
-- ============================================================================

REVOKE ALL ON TABLE public.products
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.product_variants
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.products TO authenticated;
GRANT SELECT ON TABLE public.product_variants TO authenticated;

-- ============================================================================
-- 8. RLS on public.products
-- ============================================================================

alter table public.products enable row level security;

drop policy if exists "products_select_member" on public.products;
create policy "products_select_member"
  on public.products for select
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('products.view'))
  );

drop policy if exists "products_insert_create" on public.products;
create policy "products_insert_create"
  on public.products for insert
  to authenticated
  with check (
    organization_id in (select private.authorized_org_ids('products.create'))
  );

drop policy if exists "products_update_manage" on public.products;
create policy "products_update_manage"
  on public.products for update
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('products.update'))
  )
  with check (
    organization_id in (select private.authorized_org_ids('products.update'))
  );

drop policy if exists "products_delete_blocked" on public.products;
create policy "products_delete_blocked"
  on public.products for delete
  to authenticated
  using (false);

-- ============================================================================
-- 9. RLS on public.product_variants
-- ============================================================================

alter table public.product_variants enable row level security;

drop policy if exists "product_variants_select_member" on public.product_variants;
create policy "product_variants_select_member"
  on public.product_variants for select
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('products.view'))
  );

drop policy if exists "product_variants_insert_create" on public.product_variants;
create policy "product_variants_insert_create"
  on public.product_variants for insert
  to authenticated
  with check (
    organization_id in (select private.authorized_org_ids('products.create'))
  );

drop policy if exists "product_variants_update_manage" on public.product_variants;
create policy "product_variants_update_manage"
  on public.product_variants for update
  to authenticated
  using (
    organization_id in (select private.authorized_org_ids('products.update'))
  )
  with check (
    organization_id in (select private.authorized_org_ids('products.update'))
  );

drop policy if exists "product_variants_delete_blocked" on public.product_variants;
create policy "product_variants_delete_blocked"
  on public.product_variants for delete
  to authenticated
  using (false);

-- ============================================================================
-- 10. RPC: private.create_product
-- ============================================================================

create or replace function private.create_product(
  p_organization_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_tax_rate_bps integer,
  p_is_tax_inclusive boolean,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_caller_role_id uuid;
  v_caller_rank int;
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

  -- Verify caller has products.create permission in this organization.
  if not private.has_permission(p_organization_id, 'products.create') then
    raise exception 'Caller does not have product creation permission in this organization';
  end if;

  -- Validate name.
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 160 then
    raise exception 'Product name must be between 2 and 160 characters';
  end if;

  -- Validate description.
  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'Product description must be at most 2000 characters';
  end if;

  -- Validate tax rate.
  if p_tax_rate_bps is null or p_tax_rate_bps < 0 or p_tax_rate_bps > 10000 then
    raise exception 'Tax rate must be between 0 and 10000 basis points';
  end if;

  -- Validate status on creation.
  if p_status is null or p_status not in ('draft', 'active') then
    raise exception 'Product status must be draft or active on creation';
  end if;

  -- Validate category belongs to the same organization and is active.
  if p_category_id is not null then
    perform 1
    from public.categories c
    where c.id = p_category_id
      and c.organization_id = p_organization_id
      and c.status = 'active';

    if not found then
      raise exception 'Category not found or inactive in this organization';
    end if;
  end if;

  insert into public.products
    (organization_id, category_id, name, description, status, tax_rate_bps, is_tax_inclusive)
  values (
    p_organization_id,
    p_category_id,
    trim(p_name),
    nullif(trim(p_description), ''),
    p_status,
    p_tax_rate_bps,
    coalesce(p_is_tax_inclusive, false)
  )
  returning id into v_product_id;

  -- Audit log: product.created
  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    p_organization_id,
    auth.uid(),
    'product.created',
    'product',
    v_product_id,
    jsonb_build_object(
      'name', trim(p_name),
      'status', p_status
    ),
    now()
  );

  return v_product_id;
end;
$$;

revoke all on function private.create_product(uuid, uuid, text, text, integer, boolean, text) from public, anon, authenticated;

create or replace function public.create_product(
  p_organization_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_tax_rate_bps integer,
  p_is_tax_inclusive boolean,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_product(
    p_organization_id, p_category_id, p_name, p_description,
    p_tax_rate_bps, p_is_tax_inclusive, p_status
  );
end;
$$;

revoke all on function public.create_product(uuid, uuid, text, text, integer, boolean, text) from public, anon;
grant execute on function public.create_product(uuid, uuid, text, text, integer, boolean, text) to authenticated;

-- ============================================================================
-- 11. RPC: private.update_product
-- ============================================================================

create or replace function private.update_product(
  p_product_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_tax_rate_bps integer,
  p_is_tax_inclusive boolean,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_category_id uuid;
  v_old_name text;
  v_old_description text;
  v_old_tax_rate_bps integer;
  v_old_is_tax_inclusive boolean;
  v_old_status text;
  v_old_archived_at timestamptz;
  v_new_archived_at timestamptz;
  v_changed_columns text[];
begin
  -- Lock the product row and resolve its organization.
  select p.organization_id, p.category_id, p.name, p.description,
         p.tax_rate_bps, p.is_tax_inclusive, p.status, p.archived_at
  into v_organization_id, v_old_category_id, v_old_name, v_old_description,
       v_old_tax_rate_bps, v_old_is_tax_inclusive, v_old_status, v_old_archived_at
  from public.products p
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'Product not found';
  end if;

  -- Verify caller is an active member of the product's organization.
  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  -- Verify caller has products.update permission in this organization.
  if not private.has_permission(v_organization_id, 'products.update') then
    raise exception 'Caller does not have product update permission in this organization';
  end if;

  -- Validate name.
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 160 then
    raise exception 'Product name must be between 2 and 160 characters';
  end if;

  -- Validate description.
  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'Product description must be at most 2000 characters';
  end if;

  -- Validate tax rate.
  if p_tax_rate_bps is null or p_tax_rate_bps < 0 or p_tax_rate_bps > 10000 then
    raise exception 'Tax rate must be between 0 and 10000 basis points';
  end if;

  -- Validate status.
  if p_status is null or p_status not in ('draft', 'active', 'archived') then
    raise exception 'Product status must be draft, active or archived';
  end if;

  -- Validate category belongs to the same organization and is active.
  if p_category_id is not null then
    perform 1
    from public.categories c
    where c.id = p_category_id
      and c.organization_id = v_organization_id
      and c.status = 'active';

    if not found then
      raise exception 'Category not found or inactive in this organization';
    end if;
  end if;

  -- Keep archived_at consistent with status.
  if p_status = 'archived' then
    v_new_archived_at := coalesce(v_old_archived_at, now());
  else
    v_new_archived_at := null;
  end if;

  -- Detect changed columns for audit.
  if v_old_category_id is distinct from p_category_id then
    v_changed_columns := array_append(v_changed_columns, 'category_id');
  end if;
  if v_old_name is distinct from trim(p_name) then
    v_changed_columns := array_append(v_changed_columns, 'name');
  end if;
  if v_old_description is distinct from nullif(trim(p_description), '') then
    v_changed_columns := array_append(v_changed_columns, 'description');
  end if;
  if v_old_tax_rate_bps is distinct from p_tax_rate_bps then
    v_changed_columns := array_append(v_changed_columns, 'tax_rate_bps');
  end if;
  if v_old_is_tax_inclusive is distinct from coalesce(p_is_tax_inclusive, false) then
    v_changed_columns := array_append(v_changed_columns, 'is_tax_inclusive');
  end if;
  if v_old_status is distinct from p_status then
    v_changed_columns := array_append(v_changed_columns, 'status');
  end if;

  update public.products
  set category_id = p_category_id,
      name = trim(p_name),
      description = nullif(trim(p_description), ''),
      tax_rate_bps = p_tax_rate_bps,
      is_tax_inclusive = coalesce(p_is_tax_inclusive, false),
      status = p_status,
      archived_at = v_new_archived_at,
      updated_at = now()
  where id = p_product_id;

  -- Audit log: product.updated (only if something changed).
  if v_changed_columns is not null then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      v_organization_id,
      auth.uid(),
      'product.updated',
      'product',
      p_product_id,
      jsonb_build_object('changed_columns', v_changed_columns),
      now()
    );
  end if;
end;
$$;

revoke all on function private.update_product(uuid, uuid, text, text, integer, boolean, text) from public, anon, authenticated;

create or replace function public.update_product(
  p_product_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_tax_rate_bps integer,
  p_is_tax_inclusive boolean,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.update_product(
    p_product_id, p_category_id, p_name, p_description,
    p_tax_rate_bps, p_is_tax_inclusive, p_status
  );
end;
$$;

revoke all on function public.update_product(uuid, uuid, text, text, integer, boolean, text) from public, anon;
grant execute on function public.update_product(uuid, uuid, text, text, integer, boolean, text) to authenticated;

-- ============================================================================
-- 12. RPC: private.archive_product
-- ============================================================================

create or replace function private.archive_product(
  p_product_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_status text;
begin
  select p.organization_id, p.status
  into v_organization_id, v_old_status
  from public.products p
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'Product not found';
  end if;

  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  if not private.has_permission(v_organization_id, 'products.archive') then
    raise exception 'Caller does not have product archive permission in this organization';
  end if;

  -- Already archived: no-op so repeated clicks do not duplicate audit events.
  if v_old_status = 'archived' then
    return;
  end if;

  update public.products
  set status = 'archived',
      archived_at = now(),
      updated_at = now()
  where id = p_product_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'product.archived',
    'product',
    p_product_id,
    jsonb_build_object('status', 'archived'),
    now()
  );
end;
$$;

revoke all on function private.archive_product(uuid) from public, anon, authenticated;

create or replace function public.archive_product(
  p_product_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.archive_product(p_product_id);
end;
$$;

revoke all on function public.archive_product(uuid) from public, anon;
grant execute on function public.archive_product(uuid) to authenticated;

-- ============================================================================
-- 13. RPC: private.set_product_status
-- ============================================================================

create or replace function private.set_product_status(
  p_product_id uuid,
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
  select p.organization_id, p.status
  into v_organization_id, v_old_status
  from public.products p
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'Product not found';
  end if;

  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  if not private.has_permission(v_organization_id, 'products.update') then
    raise exception 'Caller does not have product update permission in this organization';
  end if;

  if p_status is null or p_status not in ('draft', 'active') then
    raise exception 'Product status must be draft or active; use archive_product to archive';
  end if;

  if v_old_status = p_status then
    return;
  end if;

  update public.products
  set status = p_status,
      archived_at = null,
      updated_at = now()
  where id = p_product_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'product.status_changed',
    'product',
    p_product_id,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_status
    ),
    now()
  );
end;
$$;

revoke all on function private.set_product_status(uuid, text) from public, anon, authenticated;

create or replace function public.set_product_status(
  p_product_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.set_product_status(p_product_id, p_status);
end;
$$;

revoke all on function public.set_product_status(uuid, text) from public, anon;
grant execute on function public.set_product_status(uuid, text) to authenticated;

-- ============================================================================
-- 14. RPC: private.create_variant
-- ============================================================================

create or replace function private.create_variant(
  p_product_id uuid,
  p_sku text,
  p_barcode text,
  p_size text,
  p_colour text,
  p_cost_price_paise bigint,
  p_selling_price_paise bigint,
  p_tax_rate_bps integer,
  p_reorder_point integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant_id uuid;
  v_organization_id uuid;
  v_product_status text;
  v_sku text;
  v_barcode text;
begin
  -- Lock the product row and resolve its organization.
  select p.organization_id, p.status
  into v_organization_id, v_product_status
  from public.products p
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'Product not found';
  end if;

  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  if not private.has_permission(v_organization_id, 'products.create') then
    raise exception 'Caller does not have product creation permission in this organization';
  end if;

  if v_product_status = 'archived' then
    raise exception 'Cannot add variants to an archived product';
  end if;

  v_sku := upper(trim(p_sku));
  v_barcode := nullif(trim(p_barcode), '');

  if v_sku is null or v_sku !~ '^[A-Z0-9-]{2,40}$' then
    raise exception 'SKU must be uppercase alphanumeric or hyphen, 2-40 characters';
  end if;

  if v_barcode is not null and v_barcode !~ '^[0-9]{8,14}$' then
    raise exception 'Barcode must be 8-14 digits';
  end if;

  if p_size is not null and char_length(trim(p_size)) > 20 then
    raise exception 'Size must be at most 20 characters';
  end if;

  if p_colour is not null and char_length(trim(p_colour)) > 40 then
    raise exception 'Colour must be at most 40 characters';
  end if;

  if p_cost_price_paise is null or p_cost_price_paise < 0 then
    raise exception 'Cost price must be zero or greater';
  end if;

  if p_selling_price_paise is null or p_selling_price_paise < 0 then
    raise exception 'Selling price must be zero or greater';
  end if;

  if p_tax_rate_bps is not null and (p_tax_rate_bps < 0 or p_tax_rate_bps > 10000) then
    raise exception 'Variant tax rate must be between 0 and 10000 basis points';
  end if;

  if p_reorder_point is null or p_reorder_point < 0 then
    raise exception 'Reorder point must be zero or greater';
  end if;

  insert into public.product_variants
    (organization_id, product_id, sku, barcode, size, colour,
     cost_price_paise, selling_price_paise, tax_rate_bps, reorder_point, is_active)
  values (
    v_organization_id,
    p_product_id,
    v_sku,
    v_barcode,
    nullif(trim(p_size), ''),
    nullif(trim(p_colour), ''),
    p_cost_price_paise,
    p_selling_price_paise,
    p_tax_rate_bps,
    p_reorder_point,
    true
  )
  returning id into v_variant_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'variant.created',
    'product_variant',
    v_variant_id,
    jsonb_build_object('sku', v_sku, 'product_id', p_product_id),
    now()
  );

  return v_variant_id;
end;
$$;

revoke all on function private.create_variant(uuid, text, text, text, text, bigint, bigint, integer, integer) from public, anon, authenticated;

create or replace function public.create_variant(
  p_product_id uuid,
  p_sku text,
  p_barcode text,
  p_size text,
  p_colour text,
  p_cost_price_paise bigint,
  p_selling_price_paise bigint,
  p_tax_rate_bps integer,
  p_reorder_point integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_variant(
    p_product_id, p_sku, p_barcode, p_size, p_colour,
    p_cost_price_paise, p_selling_price_paise, p_tax_rate_bps, p_reorder_point
  );
end;
$$;

revoke all on function public.create_variant(uuid, text, text, text, text, bigint, bigint, integer, integer) from public, anon;
grant execute on function public.create_variant(uuid, text, text, text, text, bigint, bigint, integer, integer) to authenticated;

-- ============================================================================
-- 15. RPC: private.update_variant
-- ============================================================================

create or replace function private.update_variant(
  p_variant_id uuid,
  p_sku text,
  p_barcode text,
  p_size text,
  p_colour text,
  p_cost_price_paise bigint,
  p_selling_price_paise bigint,
  p_tax_rate_bps integer,
  p_reorder_point integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_product_status text;
  v_old_sku text;
  v_old_barcode text;
  v_old_size text;
  v_old_colour text;
  v_old_cost_price_paise bigint;
  v_old_selling_price_paise bigint;
  v_old_tax_rate_bps integer;
  v_old_reorder_point integer;
  v_sku text;
  v_barcode text;
  v_changed_columns text[];
begin
  select v.organization_id, p.status,
         v.sku, v.barcode, v.size, v.colour,
         v.cost_price_paise, v.selling_price_paise, v.tax_rate_bps, v.reorder_point
  into v_organization_id, v_product_status,
       v_old_sku, v_old_barcode, v_old_size, v_old_colour,
       v_old_cost_price_paise, v_old_selling_price_paise, v_old_tax_rate_bps, v_old_reorder_point
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id
  for update of v;

  if not found then
    raise exception 'Variant not found';
  end if;

  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  if not private.has_permission(v_organization_id, 'products.update') then
    raise exception 'Caller does not have product update permission in this organization';
  end if;

  if v_product_status = 'archived' then
    raise exception 'Cannot update variants of an archived product';
  end if;

  v_sku := upper(trim(p_sku));
  v_barcode := nullif(trim(p_barcode), '');

  if v_sku is null or v_sku !~ '^[A-Z0-9-]{2,40}$' then
    raise exception 'SKU must be uppercase alphanumeric or hyphen, 2-40 characters';
  end if;

  if v_barcode is not null and v_barcode !~ '^[0-9]{8,14}$' then
    raise exception 'Barcode must be 8-14 digits';
  end if;

  if p_size is not null and char_length(trim(p_size)) > 20 then
    raise exception 'Size must be at most 20 characters';
  end if;

  if p_colour is not null and char_length(trim(p_colour)) > 40 then
    raise exception 'Colour must be at most 40 characters';
  end if;

  if p_cost_price_paise is null or p_cost_price_paise < 0 then
    raise exception 'Cost price must be zero or greater';
  end if;

  if p_selling_price_paise is null or p_selling_price_paise < 0 then
    raise exception 'Selling price must be zero or greater';
  end if;

  if p_tax_rate_bps is not null and (p_tax_rate_bps < 0 or p_tax_rate_bps > 10000) then
    raise exception 'Variant tax rate must be between 0 and 10000 basis points';
  end if;

  if p_reorder_point is null or p_reorder_point < 0 then
    raise exception 'Reorder point must be zero or greater';
  end if;

  if v_old_sku is distinct from v_sku then
    v_changed_columns := array_append(v_changed_columns, 'sku');
  end if;
  if v_old_barcode is distinct from v_barcode then
    v_changed_columns := array_append(v_changed_columns, 'barcode');
  end if;
  if v_old_size is distinct from nullif(trim(p_size), '') then
    v_changed_columns := array_append(v_changed_columns, 'size');
  end if;
  if v_old_colour is distinct from nullif(trim(p_colour), '') then
    v_changed_columns := array_append(v_changed_columns, 'colour');
  end if;
  if v_old_cost_price_paise is distinct from p_cost_price_paise then
    v_changed_columns := array_append(v_changed_columns, 'cost_price_paise');
  end if;
  if v_old_selling_price_paise is distinct from p_selling_price_paise then
    v_changed_columns := array_append(v_changed_columns, 'selling_price_paise');
  end if;
  if v_old_tax_rate_bps is distinct from p_tax_rate_bps then
    v_changed_columns := array_append(v_changed_columns, 'tax_rate_bps');
  end if;
  if v_old_reorder_point is distinct from p_reorder_point then
    v_changed_columns := array_append(v_changed_columns, 'reorder_point');
  end if;

  update public.product_variants
  set sku = v_sku,
      barcode = v_barcode,
      size = nullif(trim(p_size), ''),
      colour = nullif(trim(p_colour), ''),
      cost_price_paise = p_cost_price_paise,
      selling_price_paise = p_selling_price_paise,
      tax_rate_bps = p_tax_rate_bps,
      reorder_point = p_reorder_point,
      updated_at = now()
  where id = p_variant_id;

  if v_changed_columns is not null then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values (
      v_organization_id,
      auth.uid(),
      'variant.updated',
      'product_variant',
      p_variant_id,
      jsonb_build_object('changed_columns', v_changed_columns),
      now()
    );
  end if;
end;
$$;

revoke all on function private.update_variant(uuid, text, text, text, text, bigint, bigint, integer, integer) from public, anon, authenticated;

create or replace function public.update_variant(
  p_variant_id uuid,
  p_sku text,
  p_barcode text,
  p_size text,
  p_colour text,
  p_cost_price_paise bigint,
  p_selling_price_paise bigint,
  p_tax_rate_bps integer,
  p_reorder_point integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.update_variant(
    p_variant_id, p_sku, p_barcode, p_size, p_colour,
    p_cost_price_paise, p_selling_price_paise, p_tax_rate_bps, p_reorder_point
  );
end;
$$;

revoke all on function public.update_variant(uuid, text, text, text, text, bigint, bigint, integer, integer) from public, anon;
grant execute on function public.update_variant(uuid, text, text, text, text, bigint, bigint, integer, integer) to authenticated;

-- ============================================================================
-- 16. RPC: private.set_variant_status
-- ============================================================================

create or replace function private.set_variant_status(
  p_variant_id uuid,
  p_is_active boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_product_status text;
  v_old_is_active boolean;
begin
  select v.organization_id, p.status, v.is_active
  into v_organization_id, v_product_status, v_old_is_active
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id
  for update of v;

  if not found then
    raise exception 'Variant not found';
  end if;

  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  if not private.has_permission(v_organization_id, 'products.update') then
    raise exception 'Caller does not have product update permission in this organization';
  end if;

  if v_product_status = 'archived' then
    raise exception 'Cannot change variants of an archived product';
  end if;

  if p_is_active is null then
    raise exception 'Variant active status is required';
  end if;

  if v_old_is_active = p_is_active then
    return;
  end if;

  update public.product_variants
  set is_active = p_is_active,
      updated_at = now()
  where id = p_variant_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'variant.status_changed',
    'product_variant',
    p_variant_id,
    jsonb_build_object(
      'old_is_active', v_old_is_active,
      'new_is_active', p_is_active
    ),
    now()
  );
end;
$$;

revoke all on function private.set_variant_status(uuid, boolean) from public, anon, authenticated;

create or replace function public.set_variant_status(
  p_variant_id uuid,
  p_is_active boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.set_variant_status(p_variant_id, p_is_active);
end;
$$;

revoke all on function public.set_variant_status(uuid, boolean) from public, anon;
grant execute on function public.set_variant_status(uuid, boolean) to authenticated;

commit;
