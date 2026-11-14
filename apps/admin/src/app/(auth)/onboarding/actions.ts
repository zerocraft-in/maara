"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CreateOrganizationResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

export async function createOrganization(
  name: string
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

  return { ok: true, organizationId: data as string };
}
