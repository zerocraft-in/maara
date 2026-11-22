"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type CategoryResult =
  | { ok: true }
  | { ok: false; error: string };

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(120, "Category name must be at most 120 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be at most 1000 characters")
    .optional()
    .or(z.literal("")),
  sort_order: z
    .number()
    .int()
    .min(0, "Sort order must be zero or greater")
    .max(999999, "Sort order must be 999999 or less"),
  parent_id: z.string().uuid().nullable(),
});

export async function createCategory(input: unknown): Promise<CategoryResult> {
  // 1. Require authenticated caller with categories.manage permission.
  const context = await requirePermission("categories.manage");

  // 2. Resolve organization exclusively from the verified session.
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  // 3. Validate input.
  const parseResult = categorySchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid category data.",
    };
  }

  const { name, description, sort_order, parent_id } = parseResult.data;

  // 4. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 5. Call the create_category RPC.
  const { error } = await supabase.rpc("create_category_with_parent", {
    p_organization_id: organization.id,
    p_name: name,
    p_description: description || null,
    p_sort_order: sort_order,
    p_parent_id: parent_id,
  });

  if (error) {
    console.error("Category creation failed.", {
      code: error.code,
      message: error.message,
    });

    if (error.code === "23505") {
      return {
        ok: false,
        error: "A category with this name already exists in your organization.",
      };
    }

    return { ok: false, error: "Unable to create category. Please try again." };
  }

  revalidatePath("/categories");
  return { ok: true };
}

const updateCategorySchema = categorySchema.extend({
  id: z.string().uuid("Invalid category ID."),
});

export async function updateCategory(input: unknown): Promise<CategoryResult> {
  // 1. Require authenticated caller with categories.manage permission.
  await requirePermission("categories.manage");

  // 2. Validate input.
  const parseResult = updateCategorySchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid category data.",
    };
  }

  const { id, name, description, sort_order, parent_id } = parseResult.data;

  // 3. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 4. Call the update_category RPC.
  const { error } = await supabase.rpc("update_category_with_parent", {
    p_category_id: id,
    p_name: name,
    p_description: description || null,
    p_sort_order: sort_order,
    p_parent_id: parent_id,
  });

  if (error) {
    console.error("Category update failed.", {
      code: error.code,
      message: error.message,
    });

    if (error.code === "23505") {
      return {
        ok: false,
        error: "A category with this name already exists in your organization.",
      };
    }

    return { ok: false, error: "Unable to update category. Please try again." };
  }

  revalidatePath("/categories");
  return { ok: true };
}

const archiveCategorySchema = z.object({
  id: z.string().uuid("Invalid category ID."),
});

export async function archiveCategory(input: unknown): Promise<CategoryResult> {
  // 1. Require authenticated caller with categories.manage permission.
  await requirePermission("categories.manage");

  // 2. Validate input.
  const parseResult = archiveCategorySchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid category ID.",
    };
  }

  // 3. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 4. Call the archive_category RPC.
  const { error } = await supabase.rpc("archive_category", {
    p_category_id: parseResult.data.id,
  });

  if (error) {
    console.error("Category archive failed.", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: "Unable to archive category. Please try again." };
  }

  revalidatePath("/categories");
  return { ok: true };
}

const setCategoryStatusSchema = z.object({
  id: z.string().uuid("Invalid category ID."),
  status: z.enum(["active", "inactive"]),
});

export async function setCategoryStatus(input: unknown): Promise<CategoryResult> {
  // 1. Require authenticated caller with categories.manage permission.
  await requirePermission("categories.manage");

  // 2. Validate input.
  const parseResult = setCategoryStatusSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid status data.",
    };
  }

  // 3. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 4. Call the set_category_status RPC.
  const { error } = await supabase.rpc("set_category_status", {
    p_category_id: parseResult.data.id,
    p_status: parseResult.data.status,
  });

  if (error) {
    console.error("Category status change failed.", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      error: "Unable to change category status. Please try again.",
    };
  }

  revalidatePath("/categories");
  return { ok: true };
}
