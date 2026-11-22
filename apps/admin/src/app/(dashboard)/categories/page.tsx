import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";
import CategoriesManager from "./categories-manager";

type CategoryRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  status: string;
  created_at: string;
  product_count: number;
};

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

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

async function fetchCategories(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select(`
      id,
      organization_id,
      name,
      slug,
      description,
      parent_id,
      sort_order,
      status,
      created_at
    `)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;

  const { data: productRows, error: productError } = await supabase
    .from("products")
    .select("category_id")
    .eq("organization_id", organizationId);

  if (productError) throw productError;

  const counts = new Map<string, number>();
  for (const row of productRows ?? []) {
    if (row.category_id) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
  }

  return (data ?? []).map((row) => ({
    ...(row as unknown as Omit<CategoryRow, "product_count">),
    product_count: counts.get(row.id) ?? 0,
  }));
}

export default async function CategoriesPage() {
  const context = await requireOrganizationOrRedirect();

  const organizationId = context.activeOrganization?.id;
  if (!organizationId) {
    redirect("/onboarding");
  }

  if (!context.permissions.has("categories.view")) {
    redirect("/overview");
  }

  const supabase: SupabaseClient = await createServerSupabaseClient();
  const canManage = context.permissions.has("categories.manage");

  let categories: CategoryRow[] = [];
  let errorMessage: string | null = null;

  try {
    categories = await fetchCategories(supabase, organizationId);
  } catch (error) {
    const err = error as { code?: string; message?: string } | undefined;
    console.error("Categories load failed.", {
      code: err?.code,
      message: err?.message ?? String(error),
    });
    errorMessage = "Unable to load categories. Please try again.";
  }

  return (
    <CategoriesManager
      categories={categories}
      canManage={canManage}
      errorMessage={errorMessage}
    />
  );
}
