import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

import {
  fetchCollections,
  fetchImages,
  fetchOptions,
  fetchProducts,
  fetchVariants,
  assembleProducts,
} from "@/app/(dashboard)/products/_components/data";

export async function GET(request: Request) {
  try {
    await requirePermission("products.view");

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id");

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch all related data in parallel
    const [products, variants, images, options, collections] =
      await Promise.all([
        fetchProducts(supabase, organizationId),
        fetchVariants(supabase, organizationId),
        fetchImages(supabase, organizationId),
        fetchOptions(supabase, organizationId),
        fetchCollections(supabase, organizationId),
      ]);

    // Assemble products with relations
    const assembledProducts = assembleProducts(
      products,
      variants,
      options,
      images,
      collections,
      [], // no category data needed for list view
    );

    // Get unique vendors and product types for filters
    const vendors = [
      ...new Set(assembledProducts.map(p => p.vendor).filter(Boolean)),
    ] as string[];
    const productTypes = [
      ...new Set(assembledProducts.map(p => p.product_type).filter(Boolean)),
    ] as string[];

    return NextResponse.json({
      products: assembledProducts,
      vendors,
      productTypes,
    });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load products" },
      { status: 500 }
    );
  }
}
