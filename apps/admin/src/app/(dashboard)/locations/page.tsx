import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";
import LocationsManager from "./locations-manager";

type LocationRow = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address: Record<string, unknown> | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  created_at: string;
  user_locations: Array<{ user_id: string }>;
};

type MemberRow = {
  user_id: string;
  full_name: string | null;
};

type UserLocationRow = {
  user_id: string;
  location_id: string;
};

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

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

async function fetchLocations(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<LocationRow[]> {
  const { data, error } = await supabase
    .from("locations")
    .select(`
      id,
      organization_id,
      name,
      code,
      address,
      contact_phone,
      contact_email,
      status,
      created_at,
      user_locations!fk_user_locations_location ( user_id )
    `)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as unknown as LocationRow[];
}

async function fetchOrganizationMembers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      user_id,
      profiles!organization_members_user_id_fkey ( full_name )
    `)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("user_id");

  if (error) throw error;

  return (
    (data ?? []).map((row: unknown) => {
      const r = row as {
        user_id: string;
        profiles: { full_name: string | null } | null;
      };
      return {
        user_id: r.user_id,
        full_name: r.profiles?.full_name ?? null,
      };
    }) ?? []
  );
}

async function fetchUserLocations(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<UserLocationRow[]> {
  const { data, error } = await supabase
    .from("user_locations")
    .select("user_id, location_id")
    .eq("organization_id", organizationId);

  if (error) throw error;

  return (data ?? []) as unknown as UserLocationRow[];
}

export default async function LocationsPage() {
  const context = await requireOrganizationOrRedirect();

  const organizationId = context.activeOrganization?.id;
  if (!organizationId) {
    redirect("/onboarding");
  }

  if (!context.permissions.has("locations.view")) {
    redirect("/overview");
  }

  const supabase: SupabaseClient = await createServerSupabaseClient();
  const canManage = context.permissions.has("locations.manage");

  let locations: LocationRow[] = [];
  let members: MemberRow[] = [];
  let userLocations: UserLocationRow[] = [];
  let errorMessage: string | null = null;

  try {
    [locations, members, userLocations] = await Promise.all([
      fetchLocations(supabase, organizationId),
      fetchOrganizationMembers(supabase, organizationId),
      fetchUserLocations(supabase, organizationId),
    ]);
  } catch (error) {
    const err = error as { code?: string; message?: string } | undefined;
    console.error("Locations load failed.", {
      code: err?.code,
      message: err?.message ?? String(error),
    });
    errorMessage = "Unable to load locations. Please try again.";
  }

  return (
    <LocationsManager
      locations={locations}
      members={members}
      userLocations={userLocations}
      canManage={canManage}
      errorMessage={errorMessage}
    />
  );
}
