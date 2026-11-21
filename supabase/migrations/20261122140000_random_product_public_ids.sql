-- ============================================================================
-- Migration: random_product_public_ids
-- Changes product public IDs from sequential values to random 13-digit values.
-- IDs are reserved in one registry so duplicates cannot occur across any of the
-- product-domain tables, including concurrent inserts.
-- ============================================================================

begin;

create table if not exists public.product_public_id_registry (
  public_id bigint primary key,
  reserved_at timestamptz not null default now(),
  constraint product_public_id_registry_13_digit_check
    check (public_id between 1000000000000 and 9999999999999)
);

revoke all on table public.product_public_id_registry from public, anon, authenticated;

create or replace function public.generate_product_public_id()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate bigint;
begin
  loop
    candidate := 1000000000000 + floor(random() * 9000000000000)::bigint;

    begin
      insert into public.product_public_id_registry(public_id)
      values (candidate);
      return candidate;
    exception
      when unique_violation then
        -- A collision is expected occasionally; try another random number.
        null;
    end;
  end loop;
end;
$$;

revoke all on function public.generate_product_public_id() from public, anon;
grant execute on function public.generate_product_public_id() to authenticated;

-- Reserve all current IDs before rotating them, so old public URLs are never
-- accidentally reused by a future random allocation.
insert into public.product_public_id_registry(public_id)
select public_id from public.products where public_id is not null
on conflict (public_id) do nothing;
insert into public.product_public_id_registry(public_id)
select public_id from public.product_variants where public_id is not null
on conflict (public_id) do nothing;
insert into public.product_public_id_registry(public_id)
select public_id from public.product_options where public_id is not null
on conflict (public_id) do nothing;
insert into public.product_public_id_registry(public_id)
select public_id from public.product_images where public_id is not null
on conflict (public_id) do nothing;
insert into public.product_public_id_registry(public_id)
select public_id from public.product_collections where public_id is not null
on conflict (public_id) do nothing;
insert into public.product_public_id_registry(public_id)
select public_id from public.product_channel_publications where public_id is not null
on conflict (public_id) do nothing;

-- Rotate existing IDs to random values. The registry makes each new value
-- unique across all six tables.
update public.products
set public_id = public.generate_product_public_id();
update public.product_variants
set public_id = public.generate_product_public_id();
update public.product_options
set public_id = public.generate_product_public_id();
update public.product_images
set public_id = public.generate_product_public_id();
update public.product_collections
set public_id = public.generate_product_public_id();
update public.product_channel_publications
set public_id = public.generate_product_public_id();

-- All future inserts use the collision-safe random generator.
alter table public.products
  alter column public_id set default public.generate_product_public_id();
alter table public.product_variants
  alter column public_id set default public.generate_product_public_id();
alter table public.product_options
  alter column public_id set default public.generate_product_public_id();
alter table public.product_images
  alter column public_id set default public.generate_product_public_id();
alter table public.product_collections
  alter column public_id set default public.generate_product_public_id();
alter table public.product_channel_publications
  alter column public_id set default public.generate_product_public_id();

comment on table public.product_public_id_registry is
  'Reserved random 13-digit public IDs shared by product-domain tables.';
comment on function public.generate_product_public_id() is
  'Returns and reserves a random, globally unique 13-digit product public ID.';

commit;
