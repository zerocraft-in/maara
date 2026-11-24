"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CreateOrganizationResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

const TAXONOMY_VERSION = "2026-11";
const TAXONOMY_ROOT_IDS = new Set([
  "gid://shopify/TaxonomyCategory/aa",
  "gid://shopify/TaxonomyCategory/bu",
  "gid://shopify/TaxonomyCategory/na",
  "gid://shopify/TaxonomyCategory/gc",
]);

export async function createOrganization(
  name: string,
  taxonomyRootIds: string[] = [],
): Promise<CreateOrganizationResult> {
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
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: name.trim(),
    p_timezone: "Asia/Kolkata",
    p_currency: "INR",
  });

  if (error || !data) {
    return { ok: false, error: "Unable to create organization." };
  }

  const selectedRoots = [...new Set(taxonomyRootIds)];
  if (selectedRoots.length !== taxonomyRootIds.length ||
      selectedRoots.some((id) => !TAXONOMY_ROOT_IDS.has(id))) {
    return { ok: false, error: "Choose valid Shopify product category groups." };
  }

  if (selectedRoots.length > 0) {
    const { error: taxonomyError } = await supabase.rpc("set_organization_shopify_taxonomy_roots", {
      p_organization_id: data as string,
      p_version: TAXONOMY_VERSION,
      p_category_ids: selectedRoots,
    });
    if (taxonomyError) {
      console.error("Organization taxonomy setup failed.", { code: taxonomyError.code });
      return { ok: false, error: "Organization created, but product category setup failed. Please contact support." };
    }
  }

  return { ok: true, organizationId: data as string };
}
