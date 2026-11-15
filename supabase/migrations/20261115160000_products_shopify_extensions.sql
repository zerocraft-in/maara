-- ============================================================================
-- Migration: products_shopify_extensions
-- Phase 2 — Shopify-style extensions for products and variants
--
-- Adds Shopify-like features:
--   * Product options (up to 3: Size, Color, Material, etc.)
--   * Product images/media with position ordering
--   * SEO fields (meta title, description, URL handle)
--   * Shipping fields (weight, HS code, country of origin, requires shipping)
--   * Vendor, product_type, tags
--   * Collections many-to-many relationship
--   * Compare-at pricing, cost per item
--   * Inventory tracking per variant (track_quantity, quantity, continue_selling)
--   * Product status: draft, active, archived
--   * Metafields support
--
-- Depends on: 20261115140000_products_foundation.sql
-- Target: hosted Supabase STAGING only. Apply manually via the Staging
-- Dashboard SQL Editor after review. Do not apply to production.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Extend public.products with Shopify-style fields
-- ============================================================================

alter table public.products
  add column if not exists handle text not null default '' check (char_length(handle) <= 255),
  add column if not exists vendor text null check (vendor is null or char_length(vendor) <= 100),
  add column if not exists product_type text null check (product_type is null or char_length(product_type) <= 100),
  add column if not exists tags text[] not null default '{}',
  add column if not exists seo_title text null check (seo_title is null or char_length(seo_title) <= 70),
  add column if not exists seo_description text null check (seo_description is null or char_length(seo_description) <= 320),
  add column if not exists requires_shipping boolean not null default true,
  add column if not exists weight_grams integer null check (weight_grams is null or weight_grams >= 0),
  add column if not exists hs_code text null check (hs_code is null or char_length(hs_code) <= 20),
  add column if not exists country_of_origin text null check (country_of_origin is null or char_length(country_of_origin) <= 2),
  add column if not exists published_at timestamptz null,
  add column if not exists published_scope text not null default 'web' check (published_scope in ('web', 'global'));

-- Add unique constraint on handle per organization
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_org_handle_key'
  ) then
    alter table public.products
      add constraint products_org_handle_key unique (organization_id, handle);
  end if;
end
$$;

comment on column public.products.handle is 'URL-friendly handle (auto-generated from title if empty). Unique per organization.';
comment on column public.products.vendor is 'Product vendor/brand name.';
comment on column public.products.product_type is 'Product type/category (e.g., Shirt, Shoes, Accessories).';
comment on column public.products.tags is 'Array of tags for filtering and organization.';
comment on column public.products.seo_title is 'SEO page title (max 70 chars).';
comment on column public.products.seo_description is 'SEO meta description (max 320 chars).';
comment on column public.products.requires_shipping is 'Whether this physical product requires shipping.';
comment on column public.products.weight_grams is 'Weight in grams for shipping calculations.';
comment on column public.products.hs_code is 'Harmonized System code for international shipping.';
comment on column public.products.country_of_origin is 'ISO 3166-1 alpha-2 country code.';
comment on column public.products.published_at is 'When the product was published to sales channels.';
comment on column public.products.published_scope is 'Sales channels: web (online store) or global (all channels).';

-- ============================================================================
-- 2. Create public.product_options (up to 3 options per product)
-- ============================================================================

create table if not exists public.product_options (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 50),
  position integer not null default 1 check (position between 1 and 3),
  values text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_id, position),
  constraint product_options_product_fk
    foreign key (product_id, organization_id)
    references public.products(id, organization_id)
    on delete cascade
);

create index if not exists idx_product_options_org_product on public.product_options(organization_id, product_id);

comment on table public.product_options is 'Product options (e.g., Size, Color, Material). Max 3 per product, max 100 combined variants.';
comment on column public.product_options.name is 'Option name (e.g., Size, Color).';
comment on column public.product_options.position is 'Display order (1, 2, or 3).';
comment on column public.product_options.values is 'Array of option values (e.g., [Small, Medium, Large]).';

-- ============================================================================
-- 3. Extend public.product_variants with Shopify-style fields
-- ============================================================================

alter table public.product_variants
  add column if not exists option1 text null check (option1 is null or char_length(option1) <= 50),
  add column if not exists option2 text null check (option2 is null or char_length(option2) <= 50),
  add column if not exists option3 text null check (option3 is null or char_length(option3) <= 50),
  add column if not exists compare_at_price_paise bigint null check (compare_at_price_paise is null or compare_at_price_paise >= 0),
  add column if not exists cost_per_item_paise bigint not null default 0 check (cost_per_item_paise >= 0),
  add column if not exists track_quantity boolean not null default true,
  add column if not exists quantity integer not null default 0 check (quantity >= 0),
  add column if not exists continue_selling_when_out_of_stock boolean not null default false,
  add column if not exists weight_grams integer null check (weight_grams is null or weight_grams >= 0),
  add column if not exists weight_unit text not null default 'g' check (weight_unit in ('g', 'kg', 'oz', 'lb')),
  add column if not exists requires_shipping boolean not null default true;

comment on column public.product_variants.option1 is 'Value for option 1 (e.g., Small).';
comment on column public.product_variants.option2 is 'Value for option 2 (e.g., Red).';
comment on column public.product_variants.option3 is 'Value for option 3 (e.g., Cotton).';
comment on column public.product_variants.compare_at_price_paise is 'Compare-at price (strikethrough price) in paise.';
comment on column public.product_variants.cost_per_item_paise is 'Cost per item in paise for margin calculations.';
comment on column public.product_variants.track_quantity is 'Whether to track inventory quantity for this variant.';
comment on column public.product_variants.quantity is 'Available quantity (only used if track_quantity = true).';
comment on column public.product_variants.continue_selling_when_out_of_stock is 'Allow purchases when quantity <= 0.';
comment on column public.product_variants.weight_grams is 'Variant-specific weight in grams.';
comment on column public.product_variants.weight_unit is 'Weight unit: g, kg, oz, lb.';
comment on column public.product_variants.requires_shipping is 'Whether this variant requires shipping.';

-- ============================================================================
-- 4. Create public.product_images (media gallery)
-- ============================================================================

create table if not exists public.product_images (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  variant_ids uuid[] not null default '{}',
  src text not null check (char_length(src) <= 2048),
  alt text null check (alt is null or char_length(alt) <= 255),
  position integer not null default 1,
  width integer null,
  height integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_product_fk
    foreign key (product_id, organization_id)
    references public.products(id, organization_id)
    on delete cascade
);

create index if not exists idx_product_images_org_product on public.product_images(organization_id, product_id);
create index if not exists idx_product_images_position on public.product_images(product_id, position);

comment on table public.product_images is 'Product images/media gallery with position ordering.';
comment on column public.product_images.variant_ids is 'Array of variant IDs this image belongs to (empty = all variants).';
comment on column public.product_images.src is 'Image URL (Supabase Storage or external).';
comment on column public.product_images.alt is 'Alt text for accessibility and SEO.';
comment on column public.product_images.position is 'Display order in gallery.';

-- ============================================================================
-- 5. Create public.collections and product_collections (many-to-many)
-- ============================================================================

create table if not exists public.collections (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  handle text not null default '' check (char_length(handle) <= 255),
  description text null,
  image_src text null,
  sort_order text not null default 'manual' check (sort_order in ('manual', 'best-selling', 'title-ascending', 'title-descending', 'price-ascending', 'price-descending', 'created-descending', 'created-ascending')),
  template_suffix text null,
  published_at timestamptz null,
  published_scope text not null default 'web' check (published_scope in ('web', 'global')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_id_org_key unique (id, organization_id),
  constraint collections_org_handle_key unique (organization_id, handle)
);

create table if not exists public.product_collections (
  product_id uuid not null,
  collection_id uuid not null,
  organization_id uuid not null,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (product_id, collection_id, organization_id),
  constraint product_collections_product_fk
    foreign key (product_id, organization_id)
    references public.products(id, organization_id)
    on delete cascade,
  constraint product_collections_collection_fk
    foreign key (collection_id, organization_id)
    references public.collections(id, organization_id)
    on delete cascade
);

create index if not exists idx_collections_org_handle on public.collections(organization_id, handle);
create index if not exists idx_product_collections_product on public.product_collections(product_id, organization_id);
create index if not exists idx_product_collections_collection on public.product_collections(collection_id, organization_id);

comment on table public.collections is 'Smart or manual collections for organizing products.';
comment on table public.product_collections is 'Many-to-many relationship between products and collections with manual sort position.';

-- ============================================================================
-- 6. Create public.metafields for flexible custom data
-- ============================================================================

create table if not exists public.metafields (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_type text not null check (owner_type in ('product', 'variant', 'collection', 'organization')),
  owner_id uuid not null,
  namespace text not null check (char_length(namespace) <= 20),
  key text not null check (char_length(key) <= 64),
  type text not null check (type in ('string', 'integer', 'number', 'boolean', 'json', 'date', 'date_time', 'url', 'color', 'rating', 'dimension', 'volume', 'weight', 'multi_line_text', 'single_line_text', 'file_reference', 'page_reference', 'product_reference', 'variant_reference', 'collection_reference')),
  value jsonb not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, owner_type, owner_id, namespace, key)
);

create index if not exists idx_metafields_owner on public.metafields(organization_id, owner_type, owner_id);
create index if not exists idx_metafields_namespace_key on public.metafields(namespace, key);

comment on table public.metafields is 'Flexible metafields for custom data on products, variants, collections, and organizations.';
comment on column public.metafields.namespace is 'Metafield namespace (e.g., custom, specs, google).';
comment on column public.metafields.key is 'Metafield key within namespace.';
comment on column public.metafields.type is 'Metafield type for validation and UI rendering.';
comment on column public.metafields.value is 'Metafield value as JSONB.';

-- ============================================================================
-- 7. Updated at triggers for new tables
-- ============================================================================

drop trigger if exists product_options_updated_at on public.product_options;
create trigger product_options_updated_at
  before update on public.product_options
  for each row
  execute function public.updated_at_trigger();

drop trigger if exists product_images_updated_at on public.product_images;
create trigger product_images_updated_at
  before update on public.product_images
  for each row
  execute function public.updated_at_trigger();

drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at
  before update on public.collections
  for each row
  execute function public.updated_at_trigger();

drop trigger if exists metafields_updated_at on public.metafields;
create trigger metafields_updated_at
  before update on public.metafields
  for each row
  execute function public.updated_at_trigger();

-- ============================================================================
-- 8. RLS policies for new tables
-- ============================================================================

alter table public.product_options enable row level security;
alter table public.product_images enable row level security;
alter table public.collections enable row level security;
alter table public.product_collections enable row level security;
alter table public.metafields enable row level security;

-- Product Options
revoke all on table public.product_options from public, anon, authenticated;
grant select on table public.product_options to authenticated;

create policy "product_options_select_member" on public.product_options for select
  to authenticated using (organization_id in (select private.authorized_org_ids('products.view')));
create policy "product_options_insert_create" on public.product_options for insert
  to authenticated with check (organization_id in (select private.authorized_org_ids('products.create')));
create policy "product_options_update_manage" on public.product_options for update
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')))
  with check (organization_id in (select private.authorized_org_ids('products.update')));
create policy "product_options_delete_manage" on public.product_options for delete
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')));

-- Product Images
revoke all on table public.product_images from public, anon, authenticated;
grant select on table public.product_images to authenticated;

create policy "product_images_select_member" on public.product_images for select
  to authenticated using (organization_id in (select private.authorized_org_ids('products.view')));
create policy "product_images_insert_create" on public.product_images for insert
  to authenticated with check (organization_id in (select private.authorized_org_ids('products.create')));
create policy "product_images_update_manage" on public.product_images for update
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')))
  with check (organization_id in (select private.authorized_org_ids('products.update')));
create policy "product_images_delete_manage" on public.product_images for delete
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')));

-- Collections
revoke all on table public.collections from public, anon, authenticated;
grant select on table public.collections to authenticated;

create policy "collections_select_member" on public.collections for select
  to authenticated using (organization_id in (select private.authorized_org_ids('products.view')));
create policy "collections_insert_create" on public.collections for insert
  to authenticated with check (organization_id in (select private.authorized_org_ids('products.create')));
create policy "collections_update_manage" on public.collections for update
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')))
  with check (organization_id in (select private.authorized_org_ids('products.update')));
create policy "collections_delete_manage" on public.collections for delete
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')));

-- Product Collections
revoke all on table public.product_collections from public, anon, authenticated;
grant select on table public.product_collections to authenticated;

create policy "product_collections_select_member" on public.product_collections for select
  to authenticated using (organization_id in (select private.authorized_org_ids('products.view')));
create policy "product_collections_insert_create" on public.product_collections for insert
  to authenticated with check (organization_id in (select private.authorized_org_ids('products.create')));
create policy "product_collections_update_manage" on public.product_collections for update
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')))
  with check (organization_id in (select private.authorized_org_ids('products.update')));
create policy "product_collections_delete_manage" on public.product_collections for delete
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')));

-- Metafields
revoke all on table public.metafields from public, anon, authenticated;
grant select on table public.metafields to authenticated;

create policy "metafields_select_member" on public.metafields for select
  to authenticated using (organization_id in (select private.authorized_org_ids('products.view')));
create policy "metafields_insert_create" on public.metafields for insert
  to authenticated with check (organization_id in (select private.authorized_org_ids('products.create')));
create policy "metafields_update_manage" on public.metafields for update
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')))
  with check (organization_id in (select private.authorized_org_ids('products.update')));
create policy "metafields_delete_manage" on public.metafields for delete
  to authenticated using (organization_id in (select private.authorized_org_ids('products.update')));

-- ============================================================================
-- 9. Indexes for performance
-- ============================================================================

create index if not exists idx_products_org_handle on public.products(organization_id, handle);
create index if not exists idx_products_org_vendor on public.products(organization_id, vendor);
create index if not exists idx_products_org_product_type on public.products(organization_id, product_type);
create index if not exists idx_products_org_published on public.products(organization_id, published_at) where published_at is not null;
create index if not exists idx_product_variants_org_track_qty on public.product_variants(organization_id, track_quantity) where track_quantity = true;

commit;