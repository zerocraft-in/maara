"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AcceptInvitationResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

export async function acceptInvitation(
  token: string
): Promise<AcceptInvitationResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthenticated" };
  }

  // Call the private RPC that validates the invitation token, checks email
  // matching, and creates/activates the membership atomically. This RPC is
  // created by migration 003. Use the server client (not the admin client) so
  // that auth.uid() resolves from the caller's JWT inside the SECURITY DEFINER
  // RPC.
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error || !data) {
    return { ok: false, error: "Invalid or expired invitation." };
  }

  return { ok: true, organizationId: data as string };
}
