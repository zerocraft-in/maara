BEGIN;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE category_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Migration stopped: products.category_id now contains data.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE shopify_category_id IS NOT NULL
      AND shopify_category_id !~ '^gid://shopify/TaxonomyCategory/(ap|aa|ae|bt|bu|bi|co|el|fb|fr|gc|ha|hb|hg|lb|ma|me|os|pa|rc|se|so|sg|tg|na|vp)(-[0-9]+)*$'
  ) THEN
    RAISE EXCEPTION 'Migration stopped: an existing product has an invalid Shopify category GID.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_shopify_taxonomy_roots
    WHERE version <> '2026-11'
       OR category_id !~ '^gid://shopify/TaxonomyCategory/(ap|aa|ae|bt|bu|bi|co|el|fb|fr|gc|ha|hb|hg|lb|ma|me|os|pa|rc|se|so|sg|tg|na|vp)$'
  ) THEN
    RAISE EXCEPTION 'Migration stopped: existing organization taxonomy roots are not valid 2026-11 root GIDs.';
  END IF;
END
$guard$;

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
  SELECT p.organization_id, p.shopify_category_id
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
    SET shopify_category_id = p_shopify_category_id, updated_at = now()
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

REVOKE ALL ON FUNCTION private.set_product_shopify_category(uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_organization_shopify_taxonomy_roots(
  p_organization_id uuid,
  p_version text,
  p_category_ids text[]
) RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_ids text[] := coalesce(p_category_ids, ARRAY[]::text[]);
BEGIN
  IF NOT private.has_permission(p_organization_id, 'settings.manage') THEN
    RAISE insufficient_privilege USING MESSAGE = 'Missing settings.manage permission.';
  END IF;

  IF p_version IS DISTINCT FROM '2026-11' THEN
    RAISE EXCEPTION 'Unsupported Shopify taxonomy version.' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_ids) > 26
     OR cardinality(v_ids) <> (SELECT count(DISTINCT x) FROM unnest(v_ids) AS t(x)) THEN
    RAISE EXCEPTION 'Choose up to 26 unique Shopify taxonomy roots.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS requested(id)
    WHERE requested.id !~ '^gid://shopify/TaxonomyCategory/(ap|aa|ae|bt|bu|bi|co|el|fb|fr|gc|ha|hb|hg|lb|ma|me|os|pa|rc|se|so|sg|tg|na|vp)$'
  ) THEN
    RAISE EXCEPTION 'Every selected category must be a supported Shopify taxonomy root.'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.organization_shopify_taxonomy_roots
  WHERE organization_id = p_organization_id AND version = '2026-11';

  INSERT INTO public.organization_shopify_taxonomy_roots
    (organization_id, version, category_id, enabled, position)
  SELECT p_organization_id, '2026-11', requested.id, true, requested.ordinality * 10
  FROM unnest(v_ids) WITH ORDINALITY AS requested(id, ordinality);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_organization_with_taxonomy(
  p_name text,
  p_timezone text,
  p_currency text,
  p_taxonomy_root_ids text[] DEFAULT ARRAY[]::text[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_organization_id uuid;
  v_ids text[] := coalesce(p_taxonomy_root_ids, ARRAY[]::text[]);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE insufficient_privilege USING MESSAGE = 'Authentication required.';
  END IF;

  IF cardinality(v_ids) > 26
     OR cardinality(v_ids) <> (SELECT count(DISTINCT x) FROM unnest(v_ids) AS t(x)) THEN
    RAISE EXCEPTION 'Choose up to 26 unique Shopify taxonomy roots.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS requested(id)
    WHERE requested.id !~ '^gid://shopify/TaxonomyCategory/(ap|aa|ae|bt|bu|bi|co|el|fb|fr|gc|ha|hb|hg|lb|ma|me|os|pa|rc|se|so|sg|tg|na|vp)$'
  ) THEN
    RAISE EXCEPTION 'Every selected category must be a supported Shopify taxonomy root.'
      USING ERRCODE = '22023';
  END IF;

  v_organization_id := private.create_organization(p_name, p_timezone, p_currency);

  INSERT INTO public.organization_shopify_taxonomy_roots
    (organization_id, version, category_id, enabled, position)
  SELECT v_organization_id, '2026-11', requested.id, true, requested.ordinality * 10
  FROM unnest(v_ids) WITH ORDINALITY AS requested(id, ordinality);

  RETURN v_organization_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_organization_with_taxonomy(text, text, text, text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_taxonomy(text, text, text, text[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_product_with_shopify_category(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_handle text,
  p_vendor text,
  p_product_type text,
  p_tags text[],
  p_tax_rate_bps integer,
  p_is_tax_inclusive boolean,
  p_requires_shipping boolean,
  p_weight_grams integer,
  p_weight_unit text,
  p_hs_code text,
  p_country_of_origin text,
  p_seo_title text,
  p_seo_description text,
  p_published_scope text,
  p_status text,
  p_published_at timestamp with time zone,
  p_shopify_category_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product_id uuid;
BEGIN
  v_product_id := private.create_product(
    p_organization_id, NULL::uuid, p_name, p_description, p_handle,
    p_vendor, p_product_type, p_tags, p_tax_rate_bps, p_is_tax_inclusive,
    p_requires_shipping, p_weight_grams, p_weight_unit, p_hs_code,
    p_country_of_origin, p_seo_title, p_seo_description, p_published_scope,
    p_status, p_published_at
  );

  PERFORM private.set_product_shopify_category(v_product_id, p_shopify_category_id);
  RETURN v_product_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_product_with_shopify_category(
  uuid, text, text, text, text, text, text[], integer, boolean, boolean,
  integer, text, text, text, text, text, text, text, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_with_shopify_category(
  uuid, text, text, text, text, text, text[], integer, boolean, boolean,
  integer, text, text, text, text, text, text, text, timestamptz, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_product_with_shopify_category(
  p_product_id uuid,
  p_name text,
  p_description text,
  p_handle text,
  p_vendor text,
  p_product_type text,
  p_tags text[],
  p_tax_rate_bps integer,
  p_is_tax_inclusive boolean,
  p_requires_shipping boolean,
  p_weight_grams integer,
  p_weight_unit text,
  p_hs_code text,
  p_country_of_origin text,
  p_seo_title text,
  p_seo_description text,
  p_published_scope text,
  p_status text,
  p_published_at timestamp with time zone,
  p_shopify_category_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM private.update_product(
    p_product_id, NULL::uuid, p_name, p_description, p_handle, p_vendor,
    p_product_type, p_tags, p_tax_rate_bps, p_is_tax_inclusive,
    p_requires_shipping, p_weight_grams, p_weight_unit, p_hs_code,
    p_country_of_origin, p_seo_title, p_seo_description, p_published_scope,
    p_status, p_published_at
  );

  PERFORM private.set_product_shopify_category(p_product_id, p_shopify_category_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_product_with_shopify_category(
  uuid, text, text, text, text, text, text[], integer, boolean, boolean,
  integer, text, text, text, text, text, text, text, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_product_with_shopify_category(
  uuid, text, text, text, text, text, text[], integer, boolean, boolean,
  integer, text, text, text, text, text, text, text, timestamptz, text
) TO authenticated;

ALTER TABLE public.organization_shopify_taxonomy_roots
  DROP CONSTRAINT IF EXISTS organization_shopify_taxonomy_roots_version_category_id_fkey;
ALTER TABLE public.organization_shopify_taxonomy_roots
  DROP CONSTRAINT IF EXISTS organization_shopify_taxonomy_roots_version_check;
ALTER TABLE public.organization_shopify_taxonomy_roots
  ADD CONSTRAINT organization_shopify_taxonomy_roots_version_check CHECK (version = '2026-11');
ALTER TABLE public.organization_shopify_taxonomy_roots
  DROP CONSTRAINT IF EXISTS organization_shopify_taxonomy_roots_root_gid_check;
ALTER TABLE public.organization_shopify_taxonomy_roots
  ADD CONSTRAINT organization_shopify_taxonomy_roots_root_gid_check
  CHECK (category_id ~ '^gid://shopify/TaxonomyCategory/(ap|aa|ae|bt|bu|bi|co|el|fb|fr|gc|ha|hb|hg|lb|ma|me|os|pa|rc|se|so|sg|tg|na|vp)$');

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_shopify_taxonomy_category_fk;
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_shopify_category_gid_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_shopify_category_gid_check
  CHECK (
    shopify_category_id IS NULL
    OR shopify_category_id ~ '^gid://shopify/TaxonomyCategory/(ap|aa|ae|bt|bu|bi|co|el|fb|fr|gc|ha|hb|hg|lb|ma|me|os|pa|rc|se|so|sg|tg|na|vp)(-[0-9]+)*$'
  );

DROP FUNCTION IF EXISTS public.get_shopify_product_categories(text, text);
DROP VIEW IF EXISTS public.shopify_taxonomy_categories;

ALTER TABLE public.products DROP COLUMN IF EXISTS category_id;

DROP TABLE IF EXISTS public.shopify_taxonomy_category_return_reasons;
DROP TABLE IF EXISTS public.shopify_taxonomy_category_attributes;
DROP TABLE IF EXISTS public.shopify_taxonomy_attribute_values;
DROP TABLE IF EXISTS public.shopify_taxonomy_attributes;
DROP TABLE IF EXISTS public.shopify_taxonomy_return_reasons;
DROP TABLE IF EXISTS public.categories;
DROP TABLE IF EXISTS public.shopify_taxonomy_verticals;
DROP TABLE IF EXISTS public.shopify_taxonomy_releases;

COMMIT;
