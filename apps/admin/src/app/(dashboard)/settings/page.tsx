import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";
import SettingsForm from "./settings-form";
import { Separator } from "@/components/ui/separator";

type OrganizationRow = {
  id: string;
  name: string | null;
  slug: string | null;
  currency: string | null;
  timezone: string | null;
  country: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: Record<string, unknown> | null;
  logo_path: string | null;
  invoice_prefix: string | null;
  invoice_next_number: number | null;
  tax_inclusive_pricing: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

async function getOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      `
      id,
      name,
      slug,
      currency,
      timezone,
      country,
      gstin,
      phone,
      email,
      address,
      logo_path,
      invoice_prefix,
      invoice_next_number,
      tax_inclusive_pricing,
      created_at,
      updated_at
    `,
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("Organization lookup failed.", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Unable to load organization settings");
  }
  return (data ?? null) as OrganizationRow | null;
}

/**
 * Resolves the verified session context for the active organization.
 *
 * Only the "no active membership" case is turned into a redirect to
 * onboarding. Authentication and database failures are re-thrown so they
 * are never masked as a missing membership.
 */
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

  const org = await getOrganization(supabase, organizationId);
  if (!org) {
    redirect("/overview");
  }

  const canManage = context.permissions.has("settings.manage");

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0 flex items-center gap-2">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-[13px] font-bold text-brand-fg"
          >
            M
          </div>
          <div className="min-w-0 leading-tight">
            <h2 className="text-sm font-semibold tracking-[-0.02em] text-body">
              Organization Settings
            </h2>
            <p className="hidden text-2xs text-meta sm:block">
              Manage organization settings
            </p>
          </div>
        </div>
      </div>

      <Separator className="mt-4 mb-8" />

      <SettingsForm org={org} canManage={canManage} />
    </div>
  );
}
