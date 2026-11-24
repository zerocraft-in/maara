export const TAXONOMY_VERSION = "2026-11";

export type ShopifyTaxonomyRoot = {
  id: string;
  prefix: string;
  name: string;
  category_count: number;
};

export type ShopifyTaxonomyManifest = {
  version: string;
  roots: ShopifyTaxonomyRoot[];
};

export type ShopifyTaxonomyAttribute = {
  id: string;
  name: string;
  handle: string;
  description?: string;
  extended?: boolean;
};

export type ShopifyTaxonomyChild = {
  id: string;
  name: string;
};

export type ShopifyTaxonomyReturnReason = {
  id: string;
  name: string;
  handle: string;
  description?: string;
};

export type ShopifyTaxonomyCategory = {
  id: string;
  name: string;
  full_name: string;
  parent_id: string | null;
  level: number;
  children: ShopifyTaxonomyChild[];
  attributes: ShopifyTaxonomyAttribute[];
  return_reasons: ShopifyTaxonomyReturnReason[];
  ancestors: ShopifyTaxonomyChild[];
  inherits_return_reasons: boolean;
  vertical_prefix: string;
};

export type ShopifyTaxonomyVertical = {
  version: string;
  prefix: string;
  name: string;
  categories: ShopifyTaxonomyCategory[];
};

function getTaxonomyApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_SHOPIFY_TAXONOMY_API_URL?.trim();

  if (!url) {
    throw new Error("NEXT_PUBLIC_SHOPIFY_TAXONOMY_API_URL is not configured.");
  }

  return url.replace(/\/+$/, "");
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getTaxonomyApiUrl()}${path}`);

  if (!response.ok) {
    throw new Error(
      `Shopify taxonomy request failed (${response.status}): ${path}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchTaxonomyManifest(): Promise<ShopifyTaxonomyManifest> {
  const manifest = await fetchJson<ShopifyTaxonomyManifest>(
    "/v1/taxonomy/manifest",
  );

  if (
    manifest.version !== TAXONOMY_VERSION ||
    !Array.isArray(manifest.roots)
  ) {
    throw new Error("Invalid Shopify taxonomy manifest.");
  }

  return manifest;
}

export async function fetchTaxonomyVertical(
  prefix: string,
): Promise<ShopifyTaxonomyVertical> {
  if (!/^[a-z]{2}$/.test(prefix)) {
    throw new Error("Invalid Shopify taxonomy vertical prefix.");
  }

  const vertical = await fetchJson<ShopifyTaxonomyVertical>(
    `/v1/taxonomy/verticals/${encodeURIComponent(prefix)}`,
  );

  if (
    vertical.version !== TAXONOMY_VERSION ||
    vertical.prefix !== prefix ||
    !Array.isArray(vertical.categories)
  ) {
    throw new Error(`Invalid Shopify taxonomy vertical: ${prefix}`);
  }

  return {
    ...vertical,
    categories: vertical.categories.map((category) => ({
      ...category,
      vertical_prefix: prefix,
      children: category.children ?? [],
      attributes: category.attributes ?? [],
      return_reasons: category.return_reasons ?? [],
      ancestors: category.ancestors ?? [],
    })),
  };
}
