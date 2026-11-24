BEGIN;

-- Private SECURITY DEFINER implementations retain the authorization checks.
-- Grant only the authenticated role the ability to invoke those private
-- implementations from the SECURITY INVOKER public RPC wrappers.
GRANT EXECUTE ON FUNCTION private.create_product(
  uuid, uuid, text, text, text, text, text, text[], integer, boolean, boolean,
  integer, text, text, text, text, text, text, text, timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION private.update_product(
  uuid, uuid, text, text, text, text, text, text[], integer, boolean, boolean,
  integer, text, text, text, text, text, text, text, timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION private.set_product_shopify_category(uuid, text)
  TO authenticated;

ALTER FUNCTION public.create_organization_with_taxonomy(text, text, text, text[])
  SECURITY INVOKER;

ALTER FUNCTION public.create_product_with_shopify_category(
  uuid, text, text, text, text, text, text[], integer, boolean, boolean,
  integer, text, text, text, text, text, text, text, timestamptz, text
) SECURITY INVOKER;

ALTER FUNCTION public.update_product_with_shopify_category(
  uuid, text, text, text, text, text, text[], integer, boolean, boolean,
  integer, text, text, text, text, text, text, text, timestamptz, text
) SECURITY INVOKER;

ALTER FUNCTION public.set_product_shopify_category(uuid, text)
  SECURITY INVOKER;

COMMIT;
