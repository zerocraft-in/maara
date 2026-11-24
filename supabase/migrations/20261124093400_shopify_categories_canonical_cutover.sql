-- Shopify Product Taxonomy canonical cutover.
-- Preserve the former organization-owned categories table under an explicit archive name.
-- The taxonomy import and category/root/product foreign keys were verified before this migration.

do $cutover$
declare
  v_create text;
  v_update text;
  v_old text;
begin
  if to_regclass('public.categories_legacy_20261124') is not null then
    if to_regclass('public.categories') is null then
      raise exception 'Canonical categories table missing after previous cutover.';
    end if;
    if (select count(*) from public.categories) <> 64292 then
      raise exception 'Canonical taxonomy row count does not match the verified v2026-11 import.';
    end if;
    return;
  end if;

  if to_regclass('public.shopify_taxonomy_categories') is null
     or to_regclass('public.categories') is null then
    raise exception 'Expected source taxonomy and legacy categories tables are missing.';
  end if;

  select pg_get_functiondef(
    'private.create_product(uuid,uuid,text,text,text,text,text,text[],integer,boolean,boolean,integer,text,text,text,text,text,text,text,timestamptz)'::regprocedure
  ) into v_create;

  v_old := $old$  -- Validate category belongs to the same organization and is active.
  if p_category_id is not null then
    perform 1
    from public.categories c
    where c.id = p_category_id
      and c.organization_id = p_organization_id
      and c.status = 'active';

    if not found then
      raise exception 'Category not found or inactive in this organization';
    end if;
  end if;

$old$;
  if position(v_old in v_create) = 0 then
    raise exception 'Could not safely locate legacy category validation in private.create_product.';
  end if;
  v_create := replace(v_create, v_old, '');
  v_old := '(organization_id, category_id, name, description, status, handle, vendor, product_type, tags,';
  if position(v_old in v_create) = 0 then raise exception 'Could not locate create_product insert column list.'; end if;
  v_create := replace(v_create, v_old, '(organization_id, name, description, status, handle, vendor, product_type, tags,');
  v_old := E'    p_organization_id,\n    p_category_id,\n    trim(p_name),';
  if position(v_old in v_create) = 0 then raise exception 'Could not locate create_product category value.'; end if;
  v_create := replace(v_create, v_old, E'    p_organization_id,\n    trim(p_name),');
  execute v_create;

  select pg_get_functiondef(
    'private.update_product(uuid,uuid,text,text,text,text,text,text[],integer,boolean,boolean,integer,text,text,text,text,text,text,text,timestamptz)'::regprocedure
  ) into v_update;

  v_update := replace(v_update, E'  v_old_category_id uuid;\n', '');
  v_update := replace(v_update, 'select p.organization_id, p.category_id, p.name, p.description, p.handle, p.vendor, p.product_type, p.tags,',
                                  'select p.organization_id, p.name, p.description, p.handle, p.vendor, p.product_type, p.tags,');
  v_update := replace(v_update, 'into v_organization_id, v_old_category_id, v_old_name, v_old_description, v_old_handle,',
                                  'into v_organization_id, v_old_name, v_old_description, v_old_handle,');

  v_old := $old$  -- Validate category belongs to the same organization and is active.
  if p_category_id is not null then
    perform 1
    from public.categories c
    where c.id = p_category_id
      and c.organization_id = v_organization_id
      and c.status = 'active';

    if not found then
      raise exception 'Category not found or inactive in this organization';
    end if;
  end if;

$old$;
  if position(v_old in v_update) = 0 then
    raise exception 'Could not safely locate legacy category validation in private.update_product.';
  end if;
  v_update := replace(v_update, v_old, '');
  v_old := $old$  if v_old_category_id is distinct from p_category_id then
    v_changed_columns := array_append(v_changed_columns, 'category_id');
  end if;
$old$;
  if position(v_old in v_update) = 0 then raise exception 'Could not locate update_product category audit block.'; end if;
  v_update := replace(v_update, v_old, '');
  v_old := E'  update public.products\n  set category_id = p_category_id,\n      name = trim(p_name),';
  if position(v_old in v_update) = 0 then raise exception 'Could not locate update_product category assignment.'; end if;
  v_update := replace(v_update, v_old, E'  update public.products\n  set name = trim(p_name),');
  execute v_update;

  alter table public.categories rename to categories_legacy_20261124;
  alter table public.shopify_taxonomy_categories rename to categories;

  execute 'create view public.shopify_taxonomy_categories with (security_invoker = true) as select * from public.categories';
  grant select on public.shopify_taxonomy_categories to authenticated;
  grant select on public.shopify_taxonomy_categories to anon;

  drop function if exists public.create_category_with_parent(uuid,text,text,integer,uuid);
  drop function if exists public.update_category_with_parent(uuid,text,text,integer,uuid);
  drop function if exists public.archive_category(uuid);
  drop function if exists public.set_category_status(uuid,text);
  drop function if exists public.set_category_parent(uuid,uuid);
  drop function if exists public.update_category(uuid,text,text,integer);
  drop function if exists public.create_category(uuid,text,text,integer);
  drop function if exists private.archive_category(uuid);
  drop function if exists private.set_category_status(uuid,text);
  drop function if exists private.set_category_parent(uuid,uuid);
  drop function if exists private.update_category(uuid,text,text,integer);
  drop function if exists private.create_category(uuid,text,text,integer);

  drop function if exists public.create_product(uuid,uuid,text,text,integer,boolean,text);
  drop function if exists private.create_product(uuid,uuid,text,text,integer,boolean,text);
  drop function if exists public.update_product(uuid,uuid,text,text,integer,boolean,text);
  drop function if exists private.update_product(uuid,uuid,text,text,integer,boolean,text);
end
$cutover$;
