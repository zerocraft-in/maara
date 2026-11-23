-- The collection catalog remains in public.collections.
-- Product-to-collection membership is intentionally removed from this setup.
begin;
drop table if exists public.collection_products;
commit;
