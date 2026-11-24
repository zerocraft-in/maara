-- Organization-specific visibility for the shared Shopify taxonomy.
-- The taxonomy itself remains global; organizations only enable top-level roots.

begin;

create table if not exists public.organization_shopify_taxonomy_roots (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version text not null,
  category_id text not null,
  enabled boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, version, category_id),
  foreign key (version, category_id)
    references public.shopify_taxonomy_categories(version, id)
    on delete cascade
);

create index if not exists organization_shopify_taxonomy_roots_enabled_idx
  on public.organization_shopify_taxonomy_roots(organization_id, version, position)
  where enabled;

alter table public.organization_shopify_taxonomy_roots enable row level security;

drop policy if exists "Organization members can read enabled Shopify taxonomy roots"
  on public.organization_shopify_taxonomy_roots;
create policy "Organization members can read enabled Shopify taxonomy roots"
  on public.organization_shopify_taxonomy_roots
  for select to authenticated
  using (private.is_member(organization_id));

drop policy if exists "Organization settings managers can manage Shopify taxonomy roots"
  on public.organization_shopify_taxonomy_roots;
create policy "Organization settings managers can manage Shopify taxonomy roots"
  on public.organization_shopify_taxonomy_roots
  for all to authenticated
  using (private.has_permission(organization_id, 'settings.manage'))
  with check (private.has_permission(organization_id, 'settings.manage'));

grant select, insert, update, delete
  on public.organization_shopify_taxonomy_roots to authenticated;
grant all
  on public.organization_shopify_taxonomy_roots to service_role;

-- Initial category roots for the MAARA MERCH apparel organization.
-- These are official Shopify TaxonomyCategory GIDs from release 2026-11.
insert into public.organization_shopify_taxonomy_roots
  (organization_id, version, category_id, enabled, position)
select
  o.id,
  '2026-11',
  roots.category_id,
  true,
  roots.position
from public.organizations o
cross join (values
  ('gid://shopify/TaxonomyCategory/aa', 10),
  ('gid://shopify/TaxonomyCategory/bu', 20),
  ('gid://shopify/TaxonomyCategory/na', 30),
  ('gid://shopify/TaxonomyCategory/gc', 40)
) as roots(category_id, position)
where o.slug = 'maara-test-84d56d3b28174c2e96a36015d528db4e'
  and exists (
    select 1 from public.shopify_taxonomy_categories c
    where c.version = '2026-11'
      and c.id = roots.category_id
      and c.parent_id is null
  )
on conflict (organization_id, version, category_id)
do update set
  enabled = true,
  position = excluded.position,
  updated_at = now();

commit;
