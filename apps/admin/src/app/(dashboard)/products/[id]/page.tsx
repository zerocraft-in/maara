import { notFound, redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";
import ProductDetail from "./product-detail";

async function requireOrganizationOrRedirect() {
  try {
    return await requireOrganization();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === NO_ACTIVE_MEMBERSHIP_ERROR
    ) {
      redirect("/onboarding");
    }
    throw error;
  }
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Product ${id}`,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const context = await requireOrganizationOrRedirect();

  const organizationId = context.activeOrganization?.id;
  if (!organizationId) {
    redirect("/onboarding");
  }

  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      id,
      organization_id,
      category_id,
      name,
      description,
      status,
      tax_rate_bps,
      is_tax_inclusive,
      created_at,
      updated_at
    `,
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Product fetch failed:", error);
    notFound();
  }

  if (!product) {
    notFound();
  }

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select(
      `
      id,
      sku,
      barcode,
      size,
      colour,
      cost_price_paise,
      selling_price_paise,
      tax_rate_bps,
      reorder_point,
      is_active,
      created_at,
      updated_at
    `,
    )
    .eq("organization_id", organizationId)
    .eq("product_id", id)
    .order("sku", { ascending: true });

  if (variantsError) {
    console.error("Variants fetch failed:", variantsError);
    notFound();
  }

  let category: { id: string; name: string } | null = null;
  if (product.category_id) {
    const { data: categoryRow, error: categoryError } = await supabase
      .from("categories")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("id", product.category_id)
      .maybeSingle();

    if (categoryError) {
      console.error("Category fetch failed:", categoryError);
    }
    category = categoryRow ?? null;
  }

  const canUpdate = context.permissions.has("products.update");
  const canArchive = context.permissions.has("products.archive");

  return (
    <ProductDetail
      product={{
        ...product,
        categories: category,
        product_variants: (variants ?? []) as {
          id: string;
          sku: string;
          barcode: string | null;
          size: string | null;
          colour: string | null;
          cost_price_paise: number;
          selling_price_paise: number;
          tax_rate_bps: number | null;
          reorder_point: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }[],
      }}
      canUpdate={canUpdate}
      canArchive={canArchive}
    />
  );
}