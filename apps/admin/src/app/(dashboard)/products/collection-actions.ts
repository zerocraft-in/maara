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
  const context = await requirePermission("products.create");
  const organization = context.activeOrganization!;
  const parseResult = createCollectionSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid collection data.",
    };
  }

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
