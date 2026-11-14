/**
 * Server-side authentication and authorization helpers.
 *
 * Every protected page, Server Action and Route Handler calls these to
 * independently verify the authenticated user and their organization
 * membership. They never trust client-supplied organization IDs or JWT
 * metadata.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
};

export type MembershipSummary = {
  organizationId: string;
  organizationName: string;
  roleKey: string;
  status: string;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
};

export type PermissionKey = string;

/**
 * Thrown when the authenticated user has no active organization membership.
 * Callers can use this to redirect to onboarding instead of surfacing an error.
 */
export const NO_ACTIVE_MEMBERSHIP_ERROR = "No active organization membership";

export type SessionContext = {
  user: SessionUser;
  memberships: MembershipSummary[];
  activeOrganization: OrganizationSummary | null;
  permissions: Set<PermissionKey>;
};

/**
 * Returns the currently authenticated user, or throws if no session exists.
 * This is the authority for all server decisions.
 */
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthenticated");
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

/**
 * Resolves the active organization from the caller's verified memberships.
 * The organization cookie is only a preference hint; membership is always
 * re-read from the database.
 */
export async function requireOrganization(): Promise<SessionContext> {
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select(
      `
      organization_id,
      status,
      role_id,
      organizations ( id, name, slug ),
      roles ( key )
    `
    )
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    // Surface the database failure instead of masking it as "no membership".
    // Only the error code, message and details are logged — never tokens,
    // cookies, credentials or invitation secrets.
    console.error("Organization membership query failed.", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error("Unable to resolve organization membership");
  }

  const activeMembership = memberships?.[0];
  if (!activeMembership) {
    throw new Error(NO_ACTIVE_MEMBERSHIP_ERROR);
  }

  // `organizations` and `roles` are many-to-one embeds (organization_members
  // holds the FK to their primary key), so PostgREST returns them as single
  // objects, not arrays. A missing organization or role is an error: this
  // must never fall through to an empty permission set.
  //
  // The casts go through `unknown` because the client has no generated
  // database types and therefore infers embedded resources as arrays.
  const org = activeMembership.organizations as unknown as {
    id: string;
    name: string;
    slug: string;
  } | null;
  const role = activeMembership.roles as unknown as { key: string } | null;

  if (!org || !role) {
    throw new Error("Unable to resolve organization membership");
  }

  const permissions = await resolvePermissions(role.key);

  return {
    user,
    memberships: memberships.map((m) => ({
      organizationId: m.organization_id,
      organizationName:
        (m.organizations as unknown as { name: string } | null)?.name || "",
      roleKey: (m.roles as unknown as { key: string } | null)?.key || "",
      status: m.status,
    })),
    activeOrganization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
    permissions,
  };
}

/**
 * Requires the user to hold a specific permission in their active
 * organization. Throws if the permission is missing.
 */
export async function requirePermission(permission: PermissionKey) {
  const context = await requireOrganization();

  if (!context.permissions.has(permission)) {
    throw new Error("Forbidden");
  }

  return context;
}

/**
 * Resolves the permission keys for a role key from the database.
 *
 * Fails closed: the database is the only source of truth. If the lookup
 * fails, or returns a state that cannot be interpreted, this throws rather
 * than falling back to a hardcoded permission map. A silent fallback would
 * grant permissions that the database never confirmed.
 */
async function resolvePermissions(roleKey: PermissionKey): Promise<Set<PermissionKey>> {
  const permissions = new Set<PermissionKey>();

  const supabase = await createServerSupabaseClient();

  const { data: rolePerms, error } = await supabase
    .from("role_permissions")
    .select(
      `
      permission_key,
      roles!inner ( key )
    `,
    )
    .eq("roles.key", roleKey);

  if (error) {
    // Log the database failure so it is diagnosable. Only the error code and
    // message are logged — never tokens, cookies or credentials.
    console.error("Permission resolution query failed.", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Unable to resolve permissions");
  }

  if (!rolePerms) {
    console.error("Permission resolution returned no result set.");
    throw new Error("Unable to resolve permissions");
  }

  rolePerms.forEach((rp) => {
    if (rp.permission_key) {
      permissions.add(rp.permission_key as string);
    }
  });

  return permissions;
}
