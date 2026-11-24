create or replace function public.set_organization_shopify_taxonomy_roots(
  p_organization_id uuid,
  p_version text,
  p_category_ids text[]
)
returns void
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $function$
declare
  v_ids text[] := coalesce(p_category_ids, array[]::text[]);
begin
  if not private.has_permission(p_organization_id, 'settings.manage') then
    raise insufficient_privilege using message = 'Missing settings.manage permission.';
  end if;

  if not exists (
    select 1 from public.shopify_taxonomy_releases
    where version = p_version and import_status = 'complete'
  ) then
    raise exception 'Taxonomy release % is not complete.', p_version using errcode = '22023';
  end if;

  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as t(x)) then
    raise exception 'Duplicate taxonomy root IDs are not allowed.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as requested(id)
    left join public.shopify_taxonomy_categories c
      on c.version = p_version and c.id = requested.id
    where c.id is null or c.parent_id is not null
  ) then
    raise exception 'Every selected category must be a root in the requested taxonomy release.'
      using errcode = '22023';
  end if;

  delete from public.organization_shopify_taxonomy_roots
  where organization_id = p_organization_id and version = p_version;

  insert into public.organization_shopify_taxonomy_roots
    (organization_id, version, category_id, enabled, position)
  select p_organization_id, p_version, requested.id, true, requested.ordinality * 10
  from unnest(v_ids) with ordinality as requested(id, ordinality);
end;
$function$;

revoke all on function public.set_organization_shopify_taxonomy_roots(uuid, text, text[]) from public, anon;
grant execute on function public.set_organization_shopify_taxonomy_roots(uuid, text, text[]) to authenticated;
