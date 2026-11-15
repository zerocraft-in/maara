"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type LocationResult =
  | { ok: true }
  | { ok: false; error: string };

const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;

const locationSchema = z.object({
  name: z.string().trim().min(2, "Location name must be at least 2 characters").max(120, "Location name must be at most 120 characters"),
  code: z.string().trim().min(1, "Location code is required").refine(
    (value) => CODE_PATTERN.test(value.toUpperCase()),
    "Location code must be uppercase alphanumeric or hyphen, 3-20 characters",
  ),
  address: z.string().trim().optional().or(z.literal("")),
  contact_phone: z.string().trim().max(20, "Phone is too long").optional().or(z.literal("")),
  contact_email: z.string().email("Enter a valid email address").max(254, "Email is too long").optional().or(z.literal("")),
});

export async function createLocation(input: unknown): Promise<LocationResult> {
  // 1. Require authenticated caller with locations.manage permission.
  const context = await requirePermission("locations.manage");

  // 2. Resolve organization exclusively from the verified session.
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }
  const organizationId = organization.id;

  // 3. Validate input.
  const parseResult = locationSchema.safeParse(input);
  if (!parseResult.success) {
    return { ok: false, error: parseResult.error.issues[0]?.message ?? "Invalid location data." };
  }

  const { name, code, address, contact_phone, contact_email } = parseResult.data;

  // 4. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 5. Call the create_location RPC.
  const { error } = await supabase.rpc("create_location", {
    p_organization_id: organizationId,
    p_name: name.trim(),
    p_code: code.trim().toUpperCase(),
    p_address: address ? { raw: address.trim() } : null,
    p_contact_phone: contact_phone || null,
    p_contact_email: contact_email || null,
  });

  if (error) {
    console.error("Location creation failed.", { code: error.code, message: error.message });

    if (error.code === "23505") {
      return { ok: false, error: "A location with this code already exists in your organization." };
    }

    return { ok: false, error: "Unable to create location. Please try again." };
  }

  revalidatePath("/locations");
  return { ok: true };
}

export async function updateLocation(input: unknown & { id: string }): Promise<LocationResult> {
  // 1. Require authenticated caller with locations.manage permission.
  await requirePermission("locations.manage");

  // 3. Validate input.
  const parseResult = locationSchema.safeParse(input);
  if (!parseResult.success) {
    return { ok: false, error: parseResult.error.issues[0]?.message ?? "Invalid location data." };
  }

  const { name, code, address, contact_phone, contact_email } = parseResult.data;
  const locationId = (input as { id?: string }).id;

  if (!locationId) {
    return { ok: false, error: "Location ID is required." };
  }

  // 4. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 5. Call the update_location RPC.
  const { error } = await supabase.rpc("update_location", {
    p_location_id: locationId,
    p_name: name.trim(),
    p_code: code.trim().toUpperCase(),
    p_address: address ? { raw: address.trim() } : null,
    p_contact_phone: contact_phone || null,
    p_contact_email: contact_email || null,
  });

  if (error) {
    console.error("Location update failed.", { code: error.code, message: error.message });

    if (error.code === "23505") {
      return { ok: false, error: "A location with this code already exists in your organization." };
    }

    return { ok: false, error: "Unable to update location. Please try again." };
  }

  revalidatePath("/locations");
  return { ok: true };
}

const archiveLocationSchema = z.object({
  id: z.string().uuid("Invalid location ID."),
});

export async function archiveLocation(input: { id: string }): Promise<LocationResult> {
  // 1. Require authenticated caller with locations.manage permission.
  await requirePermission("locations.manage");

  // 3. Validate input.
  const parseResult = archiveLocationSchema.safeParse(input);
  if (!parseResult.success) {
    return { ok: false, error: parseResult.error.issues[0]?.message ?? "Invalid location ID." };
  }

  // 4. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 5. Call the archive_location RPC.
  const { error } = await supabase.rpc("archive_location", {
    p_location_id: parseResult.data.id,
  });

  if (error) {
    console.error("Location archive failed.", { code: error.code, message: error.message });
    return { ok: false, error: "Unable to archive location. Please try again." };
  }

  revalidatePath("/locations");
  return { ok: true };
}

const assignmentSchema = z.object({
  user_id: z.string().uuid("Invalid user ID."),
  location_id: z.string().uuid("Invalid location ID."),
});

export async function assignUserToLocation(input: {
  user_id: string;
  location_id: string;
}): Promise<LocationResult> {
  // 1. Require authenticated caller with locations.manage permission.
  await requirePermission("locations.manage");

  // 3. Validate input.
  const parseResult = assignmentSchema.safeParse(input);
  if (!parseResult.success) {
    return { ok: false, error: parseResult.error.issues[0]?.message ?? "Invalid assignment data." };
  }

  // 4. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 5. Call the assign_user_to_location RPC.
  const { error } = await supabase.rpc("assign_user_to_location", {
    p_user_id: parseResult.data.user_id,
    p_location_id: parseResult.data.location_id,
  });

  if (error) {
    console.error("User assignment failed.", { code: error.code, message: error.message });

    if (error.message.includes("inactive location")) {
      return { ok: false, error: "Cannot assign a user to an inactive location." };
    }

    if (error.message.includes("different organization")) {
      return { ok: false, error: "Cannot assign a user from another organization." };
    }

    if (error.message.includes("active member")) {
      return { ok: false, error: "Target user is not an active member of this organization." };
    }

    return { ok: false, error: "Unable to assign user to location. Please try again." };
  }

  revalidatePath("/locations");
  return { ok: true };
}

export async function unassignUserFromLocation(input: {
  user_id: string;
  location_id: string;
}): Promise<LocationResult> {
  // 1. Require authenticated caller with locations.manage permission.
  await requirePermission("locations.manage");

  // 3. Validate input.
  const parseResult = assignmentSchema.safeParse(input);
  if (!parseResult.success) {
    return { ok: false, error: parseResult.error.issues[0]?.message ?? "Invalid assignment data." };
  }

  // 4. Call the authenticated Supabase client (RLS applies).
  const supabase = await createServerSupabaseClient();

  // 5. Call the unassign_user_from_location RPC.
  const { error } = await supabase.rpc("unassign_user_from_location", {
    p_user_id: parseResult.data.user_id,
    p_location_id: parseResult.data.location_id,
  });

  if (error) {
    console.error("User unassignment failed.", { code: error.code, message: error.message });
    return { ok: false, error: "Unable to unassign user from location. Please try again." };
  }

  revalidatePath("/locations");
  return { ok: true };
}
