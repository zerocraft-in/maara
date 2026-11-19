import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";
import { StoreContactDetailsClient } from "./store-contact-details-client";

async function getOrganization(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,email,phone")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load store contact details");
  return data;
}

export default async function StoreContactDetailsPage() {
  try {
    const context = await requireOrganization();
    const id = context.activeOrganization?.id;
    if (!id || !context.permissions.has("settings.view"))
      redirect("/settings/general");
    const org = await getOrganization(await createServerSupabaseClient(), id);
    if (!org) redirect("/settings/general");
    return <StoreContactDetailsClient org={org} />;
  } catch (error) {
    if (error instanceof Error && error.message === NO_ACTIVE_MEMBERSHIP_ERROR)
      redirect("/onboarding");
    throw error;
  }
}
