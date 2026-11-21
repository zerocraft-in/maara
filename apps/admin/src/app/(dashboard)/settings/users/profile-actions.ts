"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Maximum length of a stored display name. Small enough to stay legible in
 * the members table and comfortably inside what the column can hold.
 */
const MAX_PROFILE_NAME_LENGTH = 100;

const profileNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(
    MAX_PROFILE_NAME_LENGTH,
    `Name must be ${MAX_PROFILE_NAME_LENGTH} characters or fewer`,
  );

export type UpdateProfileNameResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Saves the caller's own display name.
 *
 * Ownership is established on the server and nowhere else:
 *
 * - The profile row to write is derived from the verified session
 *   (`supabase.auth.getUser()`). No user id is accepted from the browser, so
 *   a caller cannot target somebody else's profile.
 * - The write goes through the authenticated, cookie-bound client, so
 *   `auth.uid()` resolves from the caller's own JWT. The existing
 *   `profiles_update_own` row level security policy (`id = auth.uid()`) is
 *   what actually authorises the update; the `.eq("id", user.id)` filter is
 *   a second, explicit restriction on top of it.
 * - The service-role client is deliberately not used. It bypasses RLS and is
 *   reserved for the privileged invitation flow.
 */
export async function updateMyProfileName(
  fullName: string,
): Promise<UpdateProfileNameResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthenticated" };
  }

  const parsed = profileNameSchema.safeParse(fullName);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid name.",
    };
  }

  const name = parsed.data;

  // `return=representation` is requested by `.select()` so the result tells us
  // whether a row was actually written. Without it a write that row level
  // security silently filters out looks identical to a successful one.
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    // Only the error code and message are logged — never tokens or keys.
    console.error("Profile name update failed.", {
      code: error.code,
      message: error.message,
    });

    if (error.code === "42501") {
      return {
        ok: false,
        error:
          "Your account is not allowed to update your profile. Contact your administrator.",
      };
    }

    return { ok: false, error: "Unable to save your name. Please try again." };
  }

  if (!data) {
    // The row was not written: row level security filtered it out.
    console.error("Profile name update wrote no row.", { userId: user.id });
    return { ok: false, error: "Unable to save your name. Please try again." };
  }

  // Re-render /users so the team member row immediately shows the saved
  // name and the matching avatar initial.
  revalidatePath("/users");

  return { ok: true };
}
