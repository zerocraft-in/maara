"use server";

import { z } from "zod";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requirePermission } from "@/lib/auth/session";
import {
  sendInvitationEmailWithFallback,
  type InvitationMailInput,
} from "@/lib/email/invitation-mailer";

export type InviteMemberResult =
  | { ok: true }
  | { ok: false; error: string };

const inviteMemberSchema = z.object({
  email: z.string().email("Enter a valid email address").max(254, "Email is too long"),
  roleKey: z.enum(["admin", "manager", "inventory_staff", "accountant", "sales_staff"]),
});

export async function inviteMember(
  input: unknown,
): Promise<InviteMemberResult> {
  // 1. Require authenticated caller with users.invite permission.
  const context = await requirePermission("users.invite");

  // 2. Resolve organization and actor exclusively from the verified session.
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }
  const organizationId = organization.id;
  const organizationName = organization.name;
  const actorUserId = context.user.id;

  // 3. Validate input.
  const parseResult = inviteMemberSchema.safeParse(input);
  if (!parseResult.success) {
    return { ok: false, error: "Invalid invitation request." };
  }

  const { email, roleKey } = parseResult.data;

  // 4. Call the service-role Supabase client for the privileged invitation RPC.
  const supabase = createSupabaseServiceClient();

  // 5. Call the custom RPC. It returns { invitation_id, token } per row.
  const { data, error } = await supabase.rpc("invite_member", {
    p_actor_user_id: actorUserId,
    p_organization_id: organizationId,
    p_email: email,
    p_role_key: roleKey,
  });

  if (error || !data) {
    return { ok: false, error: "Unable to create invitation." };
  }

  // invite_member returns jsonb { invitation_id, token }.
  const invitationId = (data as { invitation_id?: string; token?: string })?.invitation_id;
  const token = (data as { invitation_id?: string; token?: string })?.token;

  if (!invitationId || !token) {
    return { ok: false, error: "Unable to create invitation." };
  }

  // 6. Construct the acceptance URL.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    await cancelInvitationSafely(supabase, actorUserId, invitationId);
    return { ok: false, error: "Unable to send invitation." };
  }

  let siteUrlParsed: URL;
  try {
    siteUrlParsed = new URL(siteUrl);
  } catch {
    await cancelInvitationSafely(supabase, actorUserId, invitationId);
    return { ok: false, error: "Unable to send invitation." };
  }

  // Reject URLs containing username/password credentials.
  if (siteUrlParsed.username || siteUrlParsed.password) {
    await cancelInvitationSafely(supabase, actorUserId, invitationId);
    return { ok: false, error: "Unable to send invitation." };
  }

  const isLocalhost =
    siteUrlParsed.hostname === "localhost" ||
    siteUrlParsed.hostname === "127.0.0.1";
  if (siteUrlParsed.protocol !== "https:" && !isLocalhost) {
    await cancelInvitationSafely(supabase, actorUserId, invitationId);
    return { ok: false, error: "Unable to send invitation." };
  }

  const acceptanceUrl = `${siteUrlParsed.origin}/accept-invite?token=${encodeURIComponent(token)}`;

  // 7. Send the invitation email.
  const mailInput: InvitationMailInput = {
    to: email,
    organizationName,
    role: roleKey,
    acceptanceUrl,
  };

  const mailResult = await sendInvitationEmailWithFallback(mailInput);

  if (!mailResult.ok) {
    // Email delivery failed: cancel the invitation so it cannot be used.
    await cancelInvitationSafely(supabase, actorUserId, invitationId);
    return { ok: false, error: "Unable to send invitation email. Please try again." };
  }

  return { ok: true };
}

async function cancelInvitationSafely(
  supabase: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  actorUserId: string,
  invitationId: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("cancel_invitation", {
      p_actor_user_id: actorUserId,
      p_invitation_id: invitationId,
    });
    if (error) {
      // Cancellation failed: log a generic safe message only.
      // The invitation remains pending but will expire after 72 hours.
      console.error("Invitation cancellation failed.");
    }
  } catch {
    // Thrown exception during cancellation: log a generic safe message.
    console.error("Invitation cancellation failed.");
  }
}
