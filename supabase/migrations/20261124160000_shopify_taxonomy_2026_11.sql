-- Shopify Product Taxonomy release 2026-11 (normalized reference schema).
-- Source: https://github.com/Shopify/product-taxonomy/releases/tag/v2026-11
-- This is a global reference taxonomy; it is not organization-owned.

begin;

create table if not exists public.shopify_taxonomy_releases (
  version text primary key,
  locale text not null default 'en',
  source_repository text not null default 'Shopify/product-taxonomy',
  source_tag text not null,
  imported_at timestamptz,
  import_status text not null default 'pending'
    check (import_status in ('pending','loading','complete','failed')),
  category_count integer,
  attribute_count integer,
  value_count integer,
  return_reason_count integer,
  source_manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopify_taxonomy_verticals (
  version text not null references public.shopify_taxonomy_releases(version) on delete cascade,
  prefix text not null,
  name text not null,
  primary key (version, prefix),
  unique (version, name)
);

create table if not exists public.shopify_taxonomy_categories (
  id text primary key,
  version text not null references public.shopify_taxonomy_releases(version) on delete cascade,
  vertical_prefix text not null,
  parent_id text,
  level smallint not null check (level >= 0),
  name text not null,
  full_name text not null,
  inherits_return_reasons boolean not null default false,
  children jsonb not null default '[]'::jsonb,
  ancestors jsonb not null default '[]'::jsonb,
  raw_data jsonb not null,
  unique (version, id),
  foreign key (version, vertical_prefix)
    references public.shopify_taxonomy_verticals(version, prefix) on delete cascade,
  foreign key (version, parent_id)
    references public.shopify_taxonomy_categories(version, id)
    deferrable initially deferred,
  constraint shopify_taxonomy_categories_gid_check
    check (id ~ '^gid://shopify/TaxonomyCategory/.+$')
);

create index if not exists shopify_taxonomy_categories_parent_idx
  on public.shopify_taxonomy_categories(version, parent_id);
create index if not exists shopify_taxonomy_categories_full_name_idx
  on public.shopify_taxonomy_categories(version, full_name);
create index if not exists shopify_taxonomy_categories_vertical_level_idx
  on public.shopify_taxonomy_categories(version, vertical_prefix, level);

create table if not exists public.shopify_taxonomy_attributes (
  id text not null,
  version text not null references public.shopify_taxonomy_releases(version) on delete cascade,
  name text not null,
  handle text not null,
  description text,
  extended_attributes jsonb not null default '[]'::jsonb,
  raw_data jsonb not null,
  primary key (version, id),
  unique (version, handle),
  constraint shopify_taxonomy_attributes_gid_check
    check (id ~ '^gid://shopify/TaxonomyAttribute/.+$')
);
create index if not exists shopify_taxonomy_attributes_name_idx
  on public.shopify_taxonomy_attributes(version, name);

create table if not exists public.shopify_taxonomy_attribute_values (
  id text not null,
  version text not null,
  attribute_id text not null,
  name text not null,
  handle text not null,
  raw_data jsonb not null,
  primary key (version, id),
  unique (version, attribute_id, handle),
  foreign key (version, attribute_id)
    references public.shopify_taxonomy_attributes(version, id) on delete cascade,
  constraint shopify_taxonomy_attribute_values_gid_check
    check (id ~ '^gid://shopify/TaxonomyValue/.+$')
);
create index if not exists shopify_taxonomy_attribute_values_attribute_idx
  on public.shopify_taxonomy_attribute_values(version, attribute_id);

create table if not exists public.shopify_taxonomy_category_attributes (
  version text not null,
  category_id text not null,
  attribute_id text not null,
  is_extended boolean not null default false,
  position integer not null default 0,
  primary key (version, category_id, attribute_id),
  foreign key (version, category_id)
    references public.shopify_taxonomy_categories(version, id) on delete cascade,
  foreign key (version, attribute_id)
    references public.shopify_taxonomy_attributes(version, id) on delete restrict
);

create table if not exists public.shopify_taxonomy_return_reasons (
  id text not null,
  version text not null references public.shopify_taxonomy_releases(version) on delete cascade,
  name text not null,
  handle text not null,
  description text,
  raw_data jsonb not null,
  primary key (version, id),
  unique (version, handle),
  constraint shopify_taxonomy_return_reasons_gid_check
    check (id ~ '^gid://shopify/ReturnReasonDefinition/.+$')
);

create table if not exists public.shopify_taxonomy_category_return_reasons (
  version text not null,
  category_id text not null,
  return_reason_id text not null,
  position integer not null default 0,
  primary key (version, category_id, return_reason_id),
  foreign key (version, category_id)
    references public.shopify_taxonomy_categories(version, id) on delete cascade,
  foreign key (version, return_reason_id)
    references public.shopify_taxonomy_return_reasons(version, id) on delete restrict
);

alter table public.shopify_taxonomy_releases enable row level security;
alter table public.shopify_taxonomy_verticals enable row level security;
alter table public.shopify_taxonomy_categories enable row level security;
alter table public.shopify_taxonomy_attributes enable row level security;
alter table public.shopify_taxonomy_attribute_values enable row level security;
alter table public.shopify_taxonomy_category_attributes enable row level security;
alter table public.shopify_taxonomy_return_reasons enable row level security;
alter table public.shopify_taxonomy_category_return_reasons enable row level security;

drop policy if exists "Shopify taxonomy is readable" on public.shopify_taxonomy_releases;
create policy "Shopify taxonomy is readable" on public.shopify_taxonomy_releases
  for select to anon, authenticated using (true);
drop policy if exists "Shopify taxonomy is readable" on public.shopify_taxonomy_verticals;
create policy "Shopify taxonomy is readable" on public.shopify_taxonomy_verticals
  for select to anon, authenticated using (true);
drop policy if exists "Shopify taxonomy is readable" on public.shopify_taxonomy_categories;
create policy "Shopify taxonomy is readable" on public.shopify_taxonomy_categories
  for select to anon, authenticated using (true);
drop policy if exists "Shopify taxonomy is readable" on public.shopify_taxonomy_attributes;
create policy "Shopify taxonomy is readable" on public.shopify_taxonomy_attributes
  for select to anon, authenticated using (true);
drop policy if exists "Shopify taxonomy is readable" on public.shopify_taxonomy_attribute_values;
create policy "Shopify taxonomy is readable" on public.shopify_taxonomy_attribute_values
  for select to anon, authenticated using (true);
drop policy if exists "Shopify taxonomy is readable" on public.shopify_taxonomy_category_attributes;
create policy "Shopify taxonomy is readable" on public.shopify_taxonomy_category_attributes
  for select to anon, authenticated using (true);
drop policy if exists "Shopify taxonomy is readable" on public.shopify_taxonomy_return_reasons;
create policy "Shopify taxonomy is readable" on public.shopify_taxonomy_return_reasons
  for select to anon, authenticated using (true);
drop policy if exists "Shopify taxonomy is readable" on public.shopify_taxonomy_category_return_reasons;
create policy "Shopify taxonomy is readable" on public.shopify_taxonomy_category_return_reasons
  for select to anon, authenticated using (true);

grant select on public.shopify_taxonomy_releases, public.shopify_taxonomy_verticals,
  public.shopify_taxonomy_categories, public.shopify_taxonomy_attributes,
  public.shopify_taxonomy_attribute_values, public.shopify_taxonomy_category_attributes,
  public.shopify_taxonomy_return_reasons, public.shopify_taxonomy_category_return_reasons
to anon, authenticated;

grant all on public.shopify_taxonomy_releases, public.shopify_taxonomy_verticals,
  public.shopify_taxonomy_categories, public.shopify_taxonomy_attributes,
  public.shopify_taxonomy_attribute_values, public.shopify_taxonomy_category_attributes,
  public.shopify_taxonomy_return_reasons, public.shopify_taxonomy_category_return_reasons
to service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_shopify_taxonomy_category_fk'
  ) then
    alter table public.products
      add constraint products_shopify_taxonomy_category_fk
      foreign key (shopify_category_id)
      references public.shopify_taxonomy_categories(id)
      on delete restrict not valid;
  end if;
end
$$;

create index if not exists products_shopify_taxonomy_category_idx
  on public.products(shopify_category_id);

do $
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_shopify_category_gid_check'
  ) then
    alter table public.products
      add constraint products_shopify_category_gid_check
      check (shopify_category_id is null or shopify_category_id ~ '^gid://shopify/TaxonomyCategory/.+

create or replace function private.set_product_shopify_category(
  p_product_id uuid,
  p_shopify_category_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_category_id text;
begin
  select p.organization_id, p.shopify_category_id
    into v_organization_id, v_old_category_id
  from public.products p
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'Product not found';
  end if;

  if not private.is_member(v_organization_id)
     or not (private.has_permission(v_organization_id, 'products.update')
             or private.has_permission(v_organization_id, 'products.create')) then
    raise exception 'Caller does not have product management permission in this organization';
  end if;

  if p_shopify_category_id is not null and not exists (
    select 1 from public.shopify_taxonomy_categories c
    where c.id = p_shopify_category_id and c.version = '2026-11'
  ) then
    raise exception 'Shopify taxonomy category not found in release 2026-11';
  end if;

  if v_old_category_id is distinct from p_shopify_category_id then
    update public.products
      set shopify_category_id = p_shopify_category_id,
          updated_at = now()
    where id = p_product_id;

    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values
      (v_organization_id, auth.uid(), 'product.shopify_category_assigned',
       'product', p_product_id,
       jsonb_build_object('old_shopify_category_id', v_old_category_id,
                          'new_shopify_category_id', p_shopify_category_id),
       now());
  end if;
end;
$$;

commit;
)
      not valid;
  end if;
end
$;

create or replace function private.set_product_shopify_category(
  p_product_id uuid,
  p_shopify_category_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_category_id text;
begin
  select p.organization_id, p.shopify_category_id
    into v_organization_id, v_old_category_id
  from public.products p
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'Product not found';
  end if;

  if not private.is_member(v_organization_id)
     or not (private.has_permission(v_organization_id, 'products.update')
             or private.has_permission(v_organization_id, 'products.create')) then
    raise exception 'Caller does not have product management permission in this organization';
  end if;

  if p_shopify_category_id is not null and not exists (
    select 1 from public.shopify_taxonomy_categories c
    where c.id = p_shopify_category_id and c.version = '2026-11'
  ) then
    raise exception 'Shopify taxonomy category not found in release 2026-11';
  end if;

  if v_old_category_id is distinct from p_shopify_category_id then
    update public.products
      set shopify_category_id = p_shopify_category_id,
          updated_at = now()
    where id = p_product_id;

    insert into public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    values
      (v_organization_id, auth.uid(), 'product.shopify_category_assigned',
       'product', p_product_id,
       jsonb_build_object('old_shopify_category_id', v_old_category_id,
                          'new_shopify_category_id', p_shopify_category_id),
       now());
  end if;
end;
$$;

commit;
