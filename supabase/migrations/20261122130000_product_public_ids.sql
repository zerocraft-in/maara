-- ============================================================================
-- Migration: product_public_ids
-- Adds stable 13-digit numeric public identifiers to product domain tables.
--
-- The existing UUID `id` columns remain the internal primary/foreign keys.
-- `public_id` is the safe human/API-facing custom key.
-- ============================================================================

begin;

create sequence if not exists public.product_public_id_seq
  as bigint
  minvalue 1000000000000
  maxvalue 9999999999999
  start with 1000000000000
  increment by 1
  no cycle;

-- Add the column first so existing rows can be backfilled in place.
alter table public.products
  add column if not exists public_id bigint;

alter table public.product_variants
  add column if not exists public_id bigint;

alter table public.product_options
  add column if not exists public_id bigint;

alter table public.product_images
  add column if not exists public_id bigint;

alter table public.product_collections
  add column if not exists public_id bigint;

alter table public.product_channel_publications
  add column if not exists public_id bigint;

-- Backfill existing rows. The shared sequence keeps identifiers unique across
-- the six product-domain tables, not just within an individual table.
update public.products
set public_id = nextval('public.product_public_id_seq')
where public_id is null;

update public.product_variants
set public_id = nextval('public.product_public_id_seq')
where public_id is null;

update public.product_options
set public_id = nextval('public.product_public_id_seq')
where public_id is null;

update public.product_images
set public_id = nextval('public.product_public_id_seq')
where public_id is null;

update public.product_collections
set public_id = nextval('public.product_public_id_seq')
where public_id is null;

update public.product_channel_publications
set public_id = nextval('public.product_public_id_seq')
where public_id is null;

-- Keep all future inserts automatic and enforce exactly 13 digits.
alter table public.products
  alter column public_id set default nextval('public.product_public_id_seq'),
  alter column public_id set not null;

alter table public.product_variants
  alter column public_id set default nextval('public.product_public_id_seq'),
  alter column public_id set not null;

alter table public.product_options
  alter column public_id set default nextval('public.product_public_id_seq'),
  alter column public_id set not null;

alter table public.product_images
  alter column public_id set default nextval('public.product_public_id_seq'),
  alter column public_id set not null;

alter table public.product_collections
  alter column public_id set default nextval('public.product_public_id_seq'),
  alter column public_id set not null;

alter table public.product_channel_publications
  alter column public_id set default nextval('public.product_public_id_seq'),
  alter column public_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_public_id_13_digit_check') then
    alter table public.products
      add constraint products_public_id_13_digit_check
      check (public_id between 1000000000000 and 9999999999999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_variants_public_id_13_digit_check') then
    alter table public.product_variants
      add constraint product_variants_public_id_13_digit_check
      check (public_id between 1000000000000 and 9999999999999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_options_public_id_13_digit_check') then
    alter table public.product_options
      add constraint product_options_public_id_13_digit_check
      check (public_id between 1000000000000 and 9999999999999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_images_public_id_13_digit_check') then
    alter table public.product_images
      add constraint product_images_public_id_13_digit_check
      check (public_id between 1000000000000 and 9999999999999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_collections_public_id_13_digit_check') then
    alter table public.product_collections
      add constraint product_collections_public_id_13_digit_check
      check (public_id between 1000000000000 and 9999999999999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_channel_publications_public_id_13_digit_check') then
    alter table public.product_channel_publications
      add constraint product_channel_publications_public_id_13_digit_check
      check (public_id between 1000000000000 and 9999999999999);
  end if;
end
$$;

create unique index if not exists products_public_id_key
  on public.products(public_id);
create unique index if not exists product_variants_public_id_key
  on public.product_variants(public_id);
create unique index if not exists product_options_public_id_key
  on public.product_options(public_id);
create unique index if not exists product_images_public_id_key
  on public.product_images(public_id);
create unique index if not exists product_collections_public_id_key
  on public.product_collections(public_id);
create unique index if not exists product_channel_publications_public_id_key
  on public.product_channel_publications(public_id);

comment on column public.products.public_id is 'Unique 13-digit public identifier; UUID id remains the internal primary key.';
comment on column public.product_variants.public_id is 'Unique 13-digit public identifier; UUID id remains the internal primary key.';
comment on column public.product_options.public_id is 'Unique 13-digit public identifier; UUID id remains the internal primary key.';
comment on column public.product_images.public_id is 'Unique 13-digit public identifier; UUID id remains the internal primary key.';
comment on column public.product_collections.public_id is 'Unique 13-digit public identifier for this product/collection relationship row.';
comment on column public.product_channel_publications.public_id is 'Unique 13-digit public identifier; UUID id remains the internal primary key.';

commit;
