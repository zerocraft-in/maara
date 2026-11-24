import { redirect } from "next/navigation";
import { requireOrganization, NO_ACTIVE_MEMBERSHIP_ERROR } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProductCategoryGroupsForm } from "./product-category-groups-form";

const TAXONOMY_VERSION = "2026-11";

export default async function ProductCategorySettingsPage() {
  let context;
  try {
    context = await requireOrganization();
  } catch (error) {
    if (error instanceof Error && error.message === NO_ACTIVE_MEMBERSHIP_ERROR) redirect("/onboarding");
    throw error;
  }

  const organizationId = context.activeOrganization?.id;
  if (!organizationId) redirect("/onboarding");
  if (!context.permissions.has("settings.view")) redirect("/overview");

  const supabase = await createServerSupabaseClient();
  const [{ data: roots, error: rootsError }, { data: enabled, error: enabledError }] = await Promise.all([
    supabase.from("shopify_taxonomy_categories")
      .select("id,name,vertical_prefix")
      .eq("version", TAXONOMY_VERSION)
      .is("parent_id", null)
      .order("name", { ascending: true }),
    supabase.from("organization_shopify_taxonomy_roots")
      .select("category_id")
      .eq("organization_id", organizationId)
      .eq("version", TAXONOMY_VERSION)
      .eq("enabled", true)
      .order("position", { ascending: true }),
  ]);

  if (rootsError || enabledError) {
    console.error("Product category settings load failed.", {
      rootsCode: rootsError?.code,
      enabledCode: enabledError?.code,
    });
    throw new Error("Unable to load product category settings.");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Product categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the Shopify taxonomy groups available to products in this organization.
        </p>
      </div>
      <ProductCategoryGroupsForm
        roots={(roots ?? []) as { id: string; name: string; vertical_prefix: string }[]}
        enabledIds={(enabled ?? []).map((row) => row.category_id)}
        canManage={context.permissions.has("settings.manage")}
      />
    </main>
  );
}
