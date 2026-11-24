drop policy if exists "Organization settings managers can manage Shopify taxonomy root"
  on public.organization_shopify_taxonomy_roots;

create policy "Organization settings managers can insert Shopify taxonomy roots"
  on public.organization_shopify_taxonomy_roots
  for insert to authenticated
  with check (private.has_permission(organization_id, 'settings.manage'));

create policy "Organization settings managers can update Shopify taxonomy roots"
  on public.organization_shopify_taxonomy_roots
  for update to authenticated
  using (private.has_permission(organization_id, 'settings.manage'))
  with check (private.has_permission(organization_id, 'settings.manage'));

create policy "Organization settings managers can delete Shopify taxonomy roots"
  on public.organization_shopify_taxonomy_roots
  for delete to authenticated
  using (private.has_permission(organization_id, 'settings.manage'));

create index if not exists organization_shopify_taxonomy_roots_version_category_idx
  on public.organization_shopify_taxonomy_roots (version, category_id);

create index if not exists organization_shopify_taxonomy_roots_org_enabled_position_idx
  on public.organization_shopify_taxonomy_roots (organization_id, version, enabled, position);
