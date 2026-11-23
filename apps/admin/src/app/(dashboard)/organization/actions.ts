"use server";

import { cookies } from "next/headers";

import { ACTIVE_ORGANIZATION_COOKIE, requireUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function selectActiveOrganization(organizationId: string) {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) {
    return { ok: false as const, error: "Invalid organization." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Organization selection validation failed.", {
      code: error.code,
      message: error.message,
    });
    return { ok: false as const, error: "Unable to select organization." };
  }
  if (!membership) return { ok: false as const, error: "Organization access denied." };

  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, membership.organization_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return { ok: true as const };
}
