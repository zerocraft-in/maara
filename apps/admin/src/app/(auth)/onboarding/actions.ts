"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchTaxonomyManifest } from "@/lib/shopify-taxonomy";

export type CreateOrganizationResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

export async function createOrganization(
  name: string,
  taxonomyRootIds: string[] = [],
): Promise<CreateOrganizationResult> {
  const selectedRoots = [...new Set(taxonomyRootIds)];
  if (selectedRoots.length !== taxonomyRootIds.length || selectedRoots.length > 26) {
    return { ok: false, error: "Choose valid Shopify product category groups." };
  }

  try {
    const manifest = await fetchTaxonomyManifest();
    const allowedRootIds = new Set(manifest.roots.map((root) => `gid://shopify/TaxonomyCategory/${root.prefix}`));
    if (selectedRoots.some((id) => !allowedRootIds.has(id))) {
      return { ok: false, error: "Choose valid Shopify product category groups." };
    }
  } catch {
    return { ok: false, error: "Shopify product categories are temporarily unavailable." };
  }

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthenticated" };
  }

  // Check if the user already has an active membership.
  const { data: existingMembers } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (existingMembers && existingMembers.length > 0) {
    return { ok: false, error: "You already belong to an organization." };
  }

  // Call the private RPC that creates the organization, default locations,
  // settings, and the Owner membership atomically. This RPC is created by
  // migration 003. Use the server client (not the admin client) so that
  // auth.uid() resolves from the caller's JWT inside the SECURITY DEFINER RPC.
  const { data, error } = await supabase.rpc("create_organization_with_taxonomy", {
    p_name: name.trim(),
    p_timezone: "Asia/Kolkata",
    p_currency: "INR",
    p_taxonomy_root_ids: selectedRoots,
  });

  if (error || !data) {
    return { ok: false, error: "Unable to create organization." };
  }

  return { ok: true, organizationId: data as string };
}
