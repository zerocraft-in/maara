-- Create an organization and save its selected Shopify taxonomy roots atomically.
-- The shared taxonomy remains global; only selected root GIDs are stored per organization.
create or replace function public.create_organization_with_taxonomy(
  p_name text,
  p_timezone text,
  p_currency text,
  p_taxonomy_root_ids text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_organization_id uuid;
  v_ids text[] := coalesce(p_taxonomy_root_ids, array[]::text[]);
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if cardinality(v_ids) > 26
     or cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as t(x)) then
    raise exception 'Choose up to 26 unique Shopify taxonomy roots.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.shopify_taxonomy_releases
    where version = '2026-11' and import_status = 'complete'
  ) then
    raise exception 'Shopify taxonomy release 2026-11 is not ready.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as requested(id)
    left join public.shopify_taxonomy_categories c
      on c.version = '2026-11' and c.id = requested.id
    where c.id is null or c.parent_id is not null
  ) then
    raise exception 'Every selected category must be a Shopify taxonomy root.'
      using errcode = '22023';
  end if;

  v_organization_id := private.create_organization(p_name, p_timezone, p_currency);

  insert into public.organization_shopify_taxonomy_roots
    (organization_id, version, category_id, enabled, position)
  select v_organization_id, '2026-11', requested.id, true, requested.ordinality * 10
  from unnest(v_ids) with ordinality as requested(id, ordinality);

  return v_organization_id;
end;
$function$;

revoke all on function public.create_organization_with_taxonomy(text, text, text, text[])
  from public, anon;
grant execute on function public.create_organization_with_taxonomy(text, text, text, text[])
  to authenticated;
