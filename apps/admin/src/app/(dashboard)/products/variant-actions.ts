"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type ProductResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

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
