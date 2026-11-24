import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { apiError, apiSuccess, errorCode, requestIdFrom } from "@/lib/http";

import {
  fetchCollections,
  fetchImages,
  fetchOptions,
  fetchProducts,
  fetchVariants,
  assembleProducts,
} from "@/app/(dashboard)/products/_components/data";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = await requirePermission("products.view");
    const organizationId = context.activeOrganization?.id;
    if (!organizationId) return apiError("FORBIDDEN", requestId);

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
    );

    // Get unique vendors and product types for filters
    const vendors = [
      ...new Set(assembledProducts.map(p => p.vendor).filter(Boolean)),
    ] as string[];
    const productTypes = [
      ...new Set(assembledProducts.map(p => p.product_type).filter(Boolean)),
    ] as string[];

    return apiSuccess({
      products: assembledProducts,
      vendors,
      productTypes,
    }, requestId);
  } catch (error) {
    console.error("Products API error", { requestId, error });
    return apiError(errorCode(error), requestId);
  }
}
