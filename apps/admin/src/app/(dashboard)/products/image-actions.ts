"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type ProductResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

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
