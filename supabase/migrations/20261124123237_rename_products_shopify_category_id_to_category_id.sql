BEGIN;

-- Keep the Shopify Taxonomy GID values; only rename the product column.
DO $rename$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'shopify_category_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.products RENAME COLUMN shopify_category_id TO category_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'shopify_category_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'category_id'
  ) THEN
    RAISE EXCEPTION 'Both product category columns exist; refusing ambiguous rename.';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'category_id'
  ) THEN
    RAISE EXCEPTION 'No product category column exists.';
  END IF;
END
$rename$;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_shopify_category_gid_check;
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_id_shopify_gid_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_category_id_shopify_gid_check
  CHECK (
    category_id IS NULL
    OR category_id ~ '^gid://shopify/TaxonomyCategory/(ap|aa|ae|bt|bu|bi|co|el|fb|fr|gc|ha|hb|hg|lb|ma|me|os|pa|rc|se|so|sg|tg|na|vp)(-[0-9]+)*$'
  );

COMMENT ON COLUMN public.products.category_id IS
  'Shopify Taxonomy Category GID. Taxonomy definitions are served from the Cloudflare Worker/R2, not stored in Supabase.';

CREATE OR REPLACE FUNCTION private.set_product_shopify_category(
  p_product_id uuid,
  p_shopify_category_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_organization_id uuid;
  v_old_category_id text;
  v_root_prefix text;
BEGIN
  SELECT p.organization_id, p.category_id
    INTO v_organization_id, v_old_category_id
  FROM public.products p
  WHERE p.id = p_product_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT private.is_member(v_organization_id)
     OR NOT (
       private.has_permission(v_organization_id, 'products.update')
       OR private.has_permission(v_organization_id, 'products.create')
     ) THEN
    RAISE EXCEPTION 'Caller does not have product management permission in this organization';
  END IF;

  IF p_shopify_category_id IS NOT NULL
     AND p_shopify_category_id !~ '^gid://shopify/TaxonomyCategory/(ap|aa|ae|bt|bu|bi|co|el|fb|fr|gc|ha|hb|hg|lb|ma|me|os|pa|rc|se|so|sg|tg|na|vp)(-[0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid Shopify taxonomy category GID';
  END IF;

  IF v_old_category_id IS DISTINCT FROM p_shopify_category_id
     AND p_shopify_category_id IS NOT NULL THEN
    v_root_prefix := substring(
      p_shopify_category_id
      FROM '^gid://shopify/TaxonomyCategory/([a-z]{2})'
    );

    IF NOT EXISTS (
      SELECT 1 FROM public.organization_shopify_taxonomy_roots r
      WHERE r.organization_id = v_organization_id
        AND r.version = '2026-11'
        AND r.category_id = 'gid://shopify/TaxonomyCategory/' || v_root_prefix
        AND r.enabled = true
    ) THEN
      RAISE EXCEPTION 'Enable this Shopify taxonomy root in organization settings before assigning the category';
    END IF;
  END IF;

  IF v_old_category_id IS DISTINCT FROM p_shopify_category_id THEN
    UPDATE public.products
    SET category_id = p_shopify_category_id, updated_at = now()
    WHERE id = p_product_id;

    INSERT INTO public.audit_logs
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    VALUES
      (v_organization_id, auth.uid(), 'product.shopify_category_assigned',
       'product', p_product_id,
       jsonb_build_object(
         'old_shopify_category_id', v_old_category_id,
         'new_shopify_category_id', p_shopify_category_id
       ),
       now());
  END IF;
END;
$function$;

COMMIT;
