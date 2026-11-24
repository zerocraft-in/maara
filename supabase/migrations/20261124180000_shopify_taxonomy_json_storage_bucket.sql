-- Shared, versioned source JSON for Shopify Product Taxonomy.
-- The normalized shopify_taxonomy_* tables remain the indexed query projection.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shopify-taxonomy',
  'shopify-taxonomy',
  false,
  104857600,
  array['application/gzip']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Private bucket: no client object policies are created. The importer writes
-- with the service-role key from a trusted server environment.
