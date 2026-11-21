-- Product deletion is intentionally explicit and permission-gated.
-- Variants use a restrictive product foreign key, so they are removed first.

begin;

create or replace function private.delete_product(
  p_product_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_product_name text;
begin
  select p.organization_id, p.name
    into v_organization_id, v_product_name
  from public.products p
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'Product not found';
  end if;

  if not private.is_member(v_organization_id) then
    raise exception 'Caller is not an active member of this organization';
  end if;

  if not private.has_permission(v_organization_id, 'products.archive') then
    raise exception 'Caller does not have product deletion permission in this organization';
  end if;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_organization_id,
    auth.uid(),
    'product.deleted',
    'product',
    p_product_id,
    jsonb_build_object('name', v_product_name),
    now()
  );

  delete from public.product_variants
  where product_id = p_product_id
    and organization_id = v_organization_id;

  delete from public.products
  where id = p_product_id
    and organization_id = v_organization_id;
end;
$$;

revoke all on function private.delete_product(uuid) from public, anon, authenticated;

create or replace function public.delete_product(
  p_product_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.delete_product(p_product_id);
end;
$$;

revoke all on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;

commit;
