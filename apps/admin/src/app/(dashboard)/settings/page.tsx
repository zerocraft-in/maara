import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";

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

export default async function SettingsPage() {
  const context = await requireOrganizationOrRedirect();

  const supabase: SupabaseClient = await createServerSupabaseClient();

  const organizationId = context.activeOrganization?.id;
  if (!organizationId) {
    redirect("/onboarding");
  }

  if (!context.permissions.has("settings.view")) {
    redirect("/overview");
  }

  redirect("/settings/general");
}
