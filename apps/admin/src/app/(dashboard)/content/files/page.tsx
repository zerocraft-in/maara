import { redirect } from "next/navigation";

import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";
import FilesManager from "./files-manager";

/**
 * Roles permitted to access the media manager.
 *
 * Kept in sync with the API route, which gates each method with
 * `requireRoles("admin", "owner", "manager")` plus the granular
 * `media.*` permissions.
 */
const MEDIA_ROLES: string[] = ["admin", "owner", "manager"];

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

export default async function FilesPage() {
  const context = await requireOrganizationOrRedirect();

  const organizationId = context.activeOrganization?.id;
  if (!organizationId) {
    redirect("/onboarding");
  }

  // Permission-based gate, consistent with the rest of the dashboard
  // (products.view, categories.view, etc.).
  if (!context.permissions.has("media.view")) {
    redirect("/overview");
  }

  // Role-based gate: only admin / owner / manager can access the media manager.
  const activeMembership = context.memberships.find(
    (m) => m.organizationId === organizationId
  );
  const roleKey = activeMembership?.roleKey;
  if (!roleKey || !MEDIA_ROLES.includes(roleKey)) {
    redirect("/overview");
  }

  return (
    <FilesManager
      organizationId={organizationId}
      permissions={context.permissions}
    />
  );
}
