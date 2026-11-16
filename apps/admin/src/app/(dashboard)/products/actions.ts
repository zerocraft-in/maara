"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";

export type ProductResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

// ============================================================================
// Helpers
// ============================================================================

function generateHandle(name: string, existingHandles: string[] = []): string {
  const handle = slugify(name);
  let counter = 1;
  let uniqueHandle = handle;
  while (existingHandles.includes(uniqueHandle)) {
    uniqueHandle = `${handle}-${counter}`;
    counter++;
  }
  return uniqueHandle;
}

async function getExistingHandles(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("products")
    .select("handle")
    .eq("organization_id", organizationId);
  return (data ?? []).map((d) => d.handle);
}

// ============================================================================
// Product Actions
// ============================================================================

const productBaseSchema = z.object({
  category_id: z.string().uuid("Invalid category ID.").nullable(),
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(160, "Product name must be at most 160 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  handle: z
    .string()
    .trim()
    .max(255, "Handle must be at most 255 characters")
    .optional()
    .or(z.literal("")),
  vendor: z
    .string()
    .trim()
    .max(100, "Vendor must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  product_type: z
    .string()
    .trim()
    .max(100, "Product type must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string()).default([]),
  tax_rate_bps: z
    .number()
    .int()
    .min(0, "Tax rate must be zero or greater")
    .max(10000, "Tax rate must be 100% or less"),
  is_tax_inclusive: z.boolean(),
  requires_shipping: z.boolean(),
  weight_grams: z.number().int().min(0).nullable(),
  weight_unit: z.enum(["g", "kg", "oz", "lb"]).default("g"),
  hs_code: z.string().trim().max(20).optional().or(z.literal("")),
  country_of_origin: z.string().trim().length(2).optional().or(z.literal("")),
  seo_title: z.string().trim().max(70).optional().or(z.literal("")),
  seo_description: z.string().trim().max(320).optional().or(z.literal("")),
  published_scope: z.enum(["web", "global"]).default("web"),
  status: z.enum(["draft", "active", "archived"]),
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(50),
        values: z.array(z.string().trim().min(1).max(50)),
      }),
    )
    .max(3)
    .optional(),
});

export async function createProduct(input: unknown): Promise<ProductResult> {
  const context = await requirePermission("products.create");
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  const parseResult = productBaseSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid product data.",
    };
  }

  const {
    category_id,
    name,
    description,
    handle: inputHandle,
    vendor,
    product_type,
    tags,
    tax_rate_bps,
    is_tax_inclusive,
    requires_shipping,
    weight_grams,
    weight_unit,
    hs_code,
    country_of_origin,
    seo_title,
    seo_description,
    published_scope,
    status,
    options,
  } = parseResult.data;

  if (status === "archived") {
    return { ok: false, error: "New products cannot be archived." };
  }

  const supabase = await createServerSupabaseClient();

  // Generate handle if not provided
  const existingHandles = await getExistingHandles(supabase, organization.id);
  const handle =
    inputHandle && inputHandle.trim()
      ? slugify(inputHandle.trim())
      : generateHandle(name, existingHandles);

  // Check handle uniqueness
  if (existingHandles.includes(handle)) {
    return { ok: false, error: "A product with this handle already exists." };
  }

  const published_at = status === "active" ? new Date().toISOString() : null;

  const { data, error } = await supabase.rpc("create_product", {
    p_organization_id: organization.id,
    p_category_id: category_id,
    p_name: name,
    p_description: description || null,
    p_handle: handle,
    p_vendor: vendor || null,
    p_product_type: product_type || null,
    p_tags: tags,
    p_tax_rate_bps: tax_rate_bps,
    p_is_tax_inclusive: is_tax_inclusive,
    p_requires_shipping: requires_shipping,
    p_weight_grams: weight_grams,
    p_weight_unit: weight_unit,
    p_hs_code: hs_code || null,
    p_country_of_origin: country_of_origin || null,
    p_seo_title: seo_title || null,
    p_seo_description: seo_description || null,
    p_published_scope: published_scope,
    p_status: status,
    p_published_at: published_at,
  });

  if (error) {
    console.error(
      `Product creation failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    if (error.code === "23505") {
      return { ok: false, error: "A product with this handle already exists." };
    }
    return { ok: false, error: "Unable to create product. Please try again." };
  }

  const productId = data as string;

  // Create options if provided
  if (options && options.length > 0) {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (opt.values.length > 0) {
        const { error: optError } = await supabase.rpc(
          "create_product_option",
          {
            p_organization_id: organization.id,
            p_product_id: productId,
            p_name: opt.name,
            p_position: i + 1,
            p_values: opt.values,
          },
        );
        if (optError) {
          console.error(`Option creation failed: ${optError.message}`);
        }
      }
    }
  }

  revalidatePath("/products");
  return { ok: true, id: productId };
}

const updateProductSchema = productBaseSchema.extend({
  id: z.string().uuid("Invalid product ID."),
});

export async function updateProduct(input: unknown): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = updateProductSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid product data.",
    };
  }

  const {
    id,
    category_id,
    name,
    description,
    handle: inputHandle,
    vendor,
    product_type,
    tags,
    tax_rate_bps,
    is_tax_inclusive,
    requires_shipping,
    weight_grams,
    weight_unit,
    hs_code,
    country_of_origin,
    seo_title,
    seo_description,
    published_scope,
    status,
    options,
  } = parseResult.data;

  const supabase = await createServerSupabaseClient();

  // Get current product for handle check
  const { data: currentProduct } = await supabase
    .from("products")
    .select("handle, status")
    .eq("id", id)
    .single();

  if (!currentProduct) {
    return { ok: false, error: "Product not found." };
  }

  // Handle uniqueness check
  if (
    inputHandle &&
    inputHandle.trim() &&
    slugify(inputHandle.trim()) !== currentProduct.handle
  ) {
    const existingHandles = await getExistingHandles(
      supabase,
      currentProduct.handle,
    );
    const newHandle = slugify(inputHandle.trim());
    if (existingHandles.includes(newHandle)) {
      return { ok: false, error: "A product with this handle already exists." };
    }
  }

  const handle =
    inputHandle && inputHandle.trim()
      ? slugify(inputHandle.trim())
      : currentProduct.handle;
  const wasPublished = currentProduct.status === "active";
  const willBePublished = status === "active";
  const published_at =
    willBePublished && !wasPublished ? new Date().toISOString() : null;

  const { error } = await supabase.rpc("update_product", {
    p_product_id: id,
    p_category_id: category_id,
    p_name: name,
    p_description: description || null,
    p_handle: handle,
    p_vendor: vendor || null,
    p_product_type: product_type || null,
    p_tags: tags,
    p_tax_rate_bps: tax_rate_bps,
    p_is_tax_inclusive: is_tax_inclusive,
    p_requires_shipping: requires_shipping,
    p_weight_grams: weight_grams,
    p_weight_unit: weight_unit,
    p_hs_code: hs_code || null,
    p_country_of_origin: country_of_origin || null,
    p_seo_title: seo_title || null,
    p_seo_description: seo_description || null,
    p_published_scope: published_scope,
    p_status: status,
    p_published_at: published_at,
  });

  if (error) {
    console.error(
      `Product update failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    return { ok: false, error: "Unable to update product. Please try again." };
  }

  // Update options (delete and recreate for simplicity)
  if (options !== undefined) {
    await supabase.from("product_options").delete().eq("product_id", id);

    if (options.length > 0) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt.values.length > 0) {
          await supabase.rpc("create_product_option", {
            p_organization_id: (
              await supabase
                .from("products")
                .select("organization_id")
                .eq("id", id)
                .single()
            ).data?.organization_id,
            p_product_id: id,
            p_name: opt.name,
            p_position: i + 1,
            p_values: opt.values,
          });
        }
      }
    }
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true };
}

const archiveProductSchema = z.object({
  id: z.string().uuid("Invalid product ID."),
});

export async function archiveProduct(input: unknown): Promise<ProductResult> {
  await requirePermission("products.archive");

  const parseResult = archiveProductSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid product ID.",
    };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("archive_product", {
    p_product_id: parseResult.data.id,
  });

  if (error) {
    console.error(
      `Product archive failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    return { ok: false, error: "Unable to archive product. Please try again." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${parseResult.data.id}`);
  return { ok: true };
}

const setProductStatusSchema = z.object({
  id: z.string().uuid("Invalid product ID."),
  status: z.enum(["draft", "active"]),
});

export async function setProductStatus(input: unknown): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = setProductStatusSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid status data.",
    };
  }

  const supabase = await createServerSupabaseClient();

  const { data: current } = await supabase
    .from("products")
    .select("status")
    .eq("id", parseResult.data.id)
    .single();

  const published_at =
    parseResult.data.status === "active" && current?.status !== "active"
      ? new Date().toISOString()
      : null;

  const { error } = await supabase.rpc("set_product_status", {
    p_product_id: parseResult.data.id,
    p_status: parseResult.data.status,
    p_published_at: published_at,
  });

  if (error) {
    console.error(
      `Product status change failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    return {
      ok: false,
      error: "Unable to change product status. Please try again.",
    };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${parseResult.data.id}`);
  return { ok: true };
}

// ============================================================================
// Variant Actions
// ============================================================================

const variantBaseSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .max(40, "SKU must be at most 40 characters")
    .regex(/^[A-Za-z0-9-]+$/, "SKU must be alphanumeric or hyphen")
    .transform((value) => value.toUpperCase()),
  barcode: z
    .string()
    .trim()
    .regex(/^[0-9]{8,14}$/, "Barcode must be 8-14 digits")
    .optional()
    .or(z.literal("")),
  option1: z.string().trim().max(50).optional().or(z.literal("")),
  option2: z.string().trim().max(50).optional().or(z.literal("")),
  option3: z.string().trim().max(50).optional().or(z.literal("")),
  cost_price_paise: z
    .number()
    .int()
    .min(0, "Cost price must be zero or greater"),
  selling_price_paise: z
    .number()
    .int()
    .min(0, "Selling price must be zero or greater"),
  compare_at_price_paise: z.number().int().min(0).nullable(),
  cost_per_item_paise: z
    .number()
    .int()
    .min(0, "Cost per item must be zero or greater"),
  tax_rate_bps: z.number().int().min(0).max(10000).nullable(),
  track_quantity: z.boolean(),
  quantity: z.number().int().min(0, "Quantity must be zero or greater"),
  continue_selling_when_out_of_stock: z.boolean(),
  weight_grams: z.number().int().min(0).nullable(),
  weight_unit: z.enum(["g", "kg", "oz", "lb"]).default("g"),
  requires_shipping: z.boolean(),
  reorder_point: z.number().int().min(0).max(1000000).default(0),
});

const createVariantSchema = variantBaseSchema.extend({
  product_id: z.string().uuid("Invalid product ID."),
});

export async function createVariant(input: unknown): Promise<ProductResult> {
  await requirePermission("products.create");

  const parseResult = createVariantSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid variant data.",
    };
  }

  const {
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
    reorder_point,
  } = parseResult.data;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("create_variant", {
    p_product_id: product_id,
    p_sku: sku,
    p_barcode: barcode || null,
    p_option1: option1 || null,
    p_option2: option2 || null,
    p_option3: option3 || null,
    p_cost_price_paise: cost_price_paise,
    p_selling_price_paise: selling_price_paise,
    p_compare_at_price_paise: compare_at_price_paise,
    p_cost_per_item_paise: cost_per_item_paise,
    p_tax_rate_bps: tax_rate_bps,
    p_track_quantity: track_quantity,
    p_quantity: quantity,
    p_continue_selling_when_out_of_stock: continue_selling_when_out_of_stock,
    p_weight_grams: weight_grams,
    p_weight_unit: weight_unit,
    p_requires_shipping: requires_shipping,
    p_reorder_point: reorder_point,
  });

  if (error) {
    console.error(
      `Variant creation failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "A variant with this SKU or barcode already exists in your organization.",
      };
    }
    return { ok: false, error: "Unable to create variant. Please try again." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${product_id}`);
  return { ok: true, id: data as string };
}

const updateVariantSchema = variantBaseSchema.extend({
  id: z.string().uuid("Invalid variant ID."),
});

export async function updateVariant(input: unknown): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = updateVariantSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid variant data.",
    };
  }

  const {
    id,
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
    reorder_point,
  } = parseResult.data;

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("update_variant", {
    p_variant_id: id,
    p_sku: sku,
    p_barcode: barcode || null,
    p_option1: option1 || null,
    p_option2: option2 || null,
    p_option3: option3 || null,
    p_cost_price_paise: cost_price_paise,
    p_selling_price_paise: selling_price_paise,
    p_compare_at_price_paise: compare_at_price_paise,
    p_cost_per_item_paise: cost_per_item_paise,
    p_tax_rate_bps: tax_rate_bps,
    p_track_quantity: track_quantity,
    p_quantity: quantity,
    p_continue_selling_when_out_of_stock: continue_selling_when_out_of_stock,
    p_weight_grams: weight_grams,
    p_weight_unit: weight_unit,
    p_requires_shipping: requires_shipping,
    p_reorder_point: reorder_point,
  });

  if (error) {
    console.error(
      `Variant update failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "A variant with this SKU or barcode already exists in your organization.",
      };
    }
    return { ok: false, error: "Unable to update variant. Please try again." };
  }

  revalidatePath("/products", "layout");
  return { ok: true };
}

const setVariantStatusSchema = z.object({
  id: z.string().uuid("Invalid variant ID."),
  is_active: z.boolean(),
});

export async function setVariantStatus(input: unknown): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = setVariantStatusSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid status data.",
    };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("set_variant_status", {
    p_variant_id: parseResult.data.id,
    p_is_active: parseResult.data.is_active,
  });

  if (error) {
    console.error("Variant status change failed.", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      error: "Unable to change variant status. Please try again.",
    };
  }

  revalidatePath("/products");
  return { ok: true };
}

// ============================================================================
// Image Actions
// ============================================================================

const createImageSchema = z.object({
  product_id: z.string().uuid(),
  variant_ids: z.array(z.string().uuid()).default([]),
  src: z.string().url("Invalid image URL"),
  alt: z.string().max(255).optional().or(z.literal("")),
  position: z.number().int().min(1).default(1),
});

export async function createProductImage(
  input: unknown,
): Promise<ProductResult> {
  await requirePermission("products.create");

  const parseResult = createImageSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid image data.",
    };
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      ...parseResult.data,
      organization_id: (
        await supabase
          .from("products")
          .select("organization_id")
          .eq("id", parseResult.data.product_id)
          .single()
      ).data?.organization_id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Image creation failed:", error);
    return { ok: false, error: "Unable to add image." };
  }

  revalidatePath(`/products/${parseResult.data.product_id}`);
  return { ok: true, id: data.id };
}

const updateImageSchema = z.object({
  id: z.string().uuid(),
  variant_ids: z.array(z.string().uuid()).default([]),
  alt: z.string().max(255).optional().or(z.literal("")),
  position: z.number().int().min(1).optional(),
});

export async function updateProductImage(
  input: unknown,
): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = updateImageSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid image data.",
    };
  }

  const supabase = await createServerSupabaseClient();

  const { id, ...updates } = parseResult.data;

  const { error } = await supabase
    .from("product_images")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Image update failed:", error);
    return { ok: false, error: "Unable to update image." };
  }

  revalidatePath("/products", "layout");
  return { ok: true };
}

export async function deleteProductImage(
  input: unknown,
): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parseResult.success) {
    return { ok: false, error: "Invalid image ID." };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", parseResult.data.id);

  if (error) {
    console.error("Image deletion failed:", error);
    return { ok: false, error: "Unable to delete image." };
  }

  revalidatePath("/products", "layout");
  return { ok: true };
}

// ============================================================================
// Collection Actions
// ============================================================================

const createCollectionSchema = z.object({
  title: z.string().trim().min(1).max(100),
  handle: z.string().trim().max(255).optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  image_src: z.string().url().optional().or(z.literal("")),
  sort_order: z
    .enum([
      "manual",
      "best-selling",
      "title-ascending",
      "title-descending",
      "price-ascending",
      "price-descending",
      "created-descending",
      "created-ascending",
    ])
    .default("manual"),
  template_suffix: z.string().optional().or(z.literal("")),
  published_scope: z.enum(["web", "global"]).default("web"),
});

export async function createCollection(input: unknown): Promise<ProductResult> {
  await requirePermission("products.create");

  const parseResult = createCollectionSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid collection data.",
    };
  }

  const context = await requirePermission("products.create");
  const organization = context.activeOrganization!;
  const supabase = await createServerSupabaseClient();

  const handle = parseResult.data.handle
    ? slugify(parseResult.data.handle)
    : slugify(parseResult.data.title);

  const { data, error } = await supabase
    .from("collections")
    .insert({
      organization_id: organization.id,
      ...parseResult.data,
      handle,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Collection creation failed:", error);
    if (error.code === "23505") {
      return {
        ok: false,
        error: "A collection with this handle already exists.",
      };
    }
    return { ok: false, error: "Unable to create collection." };
  }

  revalidatePath("/products");
  return { ok: true, id: data.id };
}

// ============================================================================
// Bulk Actions
// ============================================================================

export async function bulkArchiveProducts(
  input: unknown,
): Promise<ProductResult> {
  await requirePermission("products.archive");

  const parseResult = z
    .object({
      ids: z.array(z.string().uuid()),
    })
    .safeParse(input);

  if (!parseResult.success) {
    return { ok: false, error: "Invalid product IDs." };
  }

  const supabase = await createServerSupabaseClient();

  for (const id of parseResult.data.ids) {
    const { error } = await supabase.rpc("archive_product", {
      p_product_id: id,
    });
    if (error) {
      console.error(`Bulk archive failed for ${id}:`, error);
    }
  }

  revalidatePath("/products");
  return { ok: true };
}

export async function bulkSetProductStatus(
  input: unknown,
): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = z
    .object({
      ids: z.array(z.string().uuid()),
      status: z.enum(["draft", "active"]),
    })
    .safeParse(input);

  if (!parseResult.success) {
    return { ok: false, error: "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();

  for (const id of parseResult.data.ids) {
    const { error } = await supabase.rpc("set_product_status", {
      p_product_id: id,
      p_status: parseResult.data.status,
      p_published_at:
        parseResult.data.status === "active" ? new Date().toISOString() : null,
    });
    if (error) {
      console.error(`Bulk status change failed for ${id}:`, error);
    }
  }

  revalidatePath("/products");
  return { ok: true };
}

// ============================================================================
// Product Option Actions
// ============================================================================

const createProductOptionSchema = z.object({
  product_id: z.string().uuid("Invalid product ID."),
  name: z.string().trim().min(1).max(50),
  values: z.array(z.string().trim().min(1).max(50)).min(1),
  position: z.number().int().min(1).max(3),
});

export async function createProductOption(
  input: unknown,
): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = createProductOptionSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid option data.",
    };
  }

  const { product_id, name, values, position } = parseResult.data;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("create_product_option", {
    p_organization_id: (
      await supabase
        .from("products")
        .select("organization_id")
        .eq("id", product_id)
        .single()
    ).data?.organization_id,
    p_product_id: product_id,
    p_name: name,
    p_position: position,
    p_values: values,
  });

  if (error) {
    console.error(
      `Product option creation failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    return { ok: false, error: "Unable to create product option." };
  }

  revalidatePath(`/products/${product_id}`);
  return { ok: true, id: data as string };
}

const deleteProductOptionSchema = z.object({
  id: z.string().uuid("Invalid option ID."),
});

export async function deleteProductOption(
  input: unknown,
): Promise<ProductResult> {
  await requirePermission("products.update");

  const parseResult = deleteProductOptionSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid option ID.",
    };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("delete_product_option", {
    p_option_id: parseResult.data.id,
  });

  if (error) {
    console.error(
      `Product option deletion failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    return { ok: false, error: "Unable to delete product option." };
  }

  revalidatePath("/products", "layout");
  return { ok: true };
}
