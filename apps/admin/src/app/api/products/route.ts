import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    await requirePermission("products.view");

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id");

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch products with all related data
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(
        `
        id,
        organization_id,
        category_id,
        name,
        description,
        status,
        handle,
        vendor,
        product_type,
        tags,
        tax_rate_bps,
        is_tax_inclusive,
        requires_shipping,
        weight_grams,
        hs_code,
        country_of_origin,
        seo_title,
        seo_description,
        published_at,
        published_scope,
        created_at,
        updated_at
      `,
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (productsError) throw productsError;

    // Get unique vendors and product types for filters
    const vendors = [...new Set((products ?? []).map(p => p.vendor).filter(Boolean))] as string[];
    const productTypes = [...new Set((products ?? []).map(p => p.product_type).filter(Boolean))] as string[];

    // Fetch variants for all products
    const productIds = (products ?? []).map(p => p.id);
    let variants: any[] = [];
    if (productIds.length > 0) {
      const { data: variantsData, error: variantsError } = await supabase
        .from("product_variants")
        .select(
          `
          id,
          product_id,
          sku,
          barcode,
          option1,
          option2,
          option3,
          cost_price_paise,
          selling_price_paise,
          compare_at_price_paise,
          cost_per_item_paise,
          tax_rate_bps,
          track_quantity,
          quantity,
          continue_selling_when_out_of_stock,
          weight_grams,
          weight_unit,
          requires_shipping,
          is_active,
          reorder_point,
          created_at,
          updated_at
        `,
        )
        .eq("organization_id", organizationId)
        .in("product_id", productIds);
      
      if (variantsError) throw variantsError;
      variants = variantsData ?? [];
    }

    // Fetch images
    let images: any[] = [];
    if (productIds.length > 0) {
      const { data: imagesData, error: imagesError } = await supabase
        .from("product_images")
        .select("id, product_id, variant_ids, src, alt, position, width, height")
        .eq("organization_id", organizationId)
        .in("product_id", productIds)
        .order("position", { ascending: true });
      
      if (imagesError) throw imagesError;
      images = imagesData ?? [];
    }

    // Fetch options
    let options: any[] = [];
    if (productIds.length > 0) {
      const { data: optionsData, error: optionsError } = await supabase
        .from("product_options")
        .select("id, product_id, name, position, values")
        .eq("organization_id", organizationId)
        .in("product_id", productIds)
        .order("position", { ascending: true });
      
      if (optionsError) throw optionsError;
      options = optionsData ?? [];
    }

    // Fetch collections
    let collections: any[] = [];
    if (productIds.length > 0) {
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("collections")
        .select(
          `
          id,
          title,
          handle,
          description,
          image_src,
          sort_order,
          published_at,
          published_scope,
          product_collections!inner(product_id)
        `,
        )
        .eq("organization_id", organizationId)
        .in("product_collections.product_id", productIds);
      
      if (collectionsError) throw collectionsError;
      collections = collectionsData ?? [];
    }

    // Assemble products
    const variantsByProduct = new Map<string, any[]>();
    for (const variant of variants) {
      const existing = variantsByProduct.get(variant.product_id) ?? [];
      existing.push(variant);
      variantsByProduct.set(variant.product_id, existing);
    }

    const imagesByProduct = new Map<string, any[]>();
    for (const image of images) {
      const existing = imagesByProduct.get(image.product_id) ?? [];
      existing.push(image);
      imagesByProduct.set(image.product_id, existing);
    }

    const optionsByProduct = new Map<string, any[]>();
    for (const option of options) {
      const existing = optionsByProduct.get(option.product_id) ?? [];
      existing.push(option);
      optionsByProduct.set(option.product_id, existing);
    }

    const collectionsByProduct = new Map<string, any[]>();
    for (const collection of collections) {
      const productIds = collection.product_collections?.map((pc: any) => pc.product_id) ?? [];
      for (const productId of productIds) {
        const existing = collectionsByProduct.get(productId) ?? [];
        existing.push(collection);
        collectionsByProduct.set(productId, existing);
      }
    }

    const assembledProducts = (products ?? []).map((product) => ({
      ...product,
      product_variants: variantsByProduct.get(product.id) ?? [],
      product_images: imagesByProduct.get(product.id) ?? [],
      product_options: optionsByProduct.get(product.id) ?? [],
      collections: collectionsByProduct.get(product.id) ?? [],
    }));

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