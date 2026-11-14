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

  if (error || !memberships) {
    throw new Error("Unable to resolve organization membership");
  }

  const activeMembership = memberships[0];
  if (!activeMembership) {
    throw new Error("No active organization membership");
  }

  const org = (activeMembership.organizations as { id: string; name: string; slug: string }[])[0];
  const role = (activeMembership.roles as { key: string }[])[0];

  const permissions = await resolvePermissions(role.key);

  return {
    user,
    memberships: memberships.map((m) => ({
      organizationId: m.organization_id,
      organizationName: (m.organizations as { name: string }[])[0]?.name || "",
      roleKey: (m.roles as { key: string }[])[0]?.key || "",
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
 * This is a placeholder until the roles/permissions tables exist.
 * After migration 003 is applied, this queries role_permissions.
 */
/**
 * Resolves the permission keys for a role key from the database.
 * Queries the role_permissions table once migrations 002-003 are applied.
 * Falls back to a static mapping for development before migrations exist.
 */
async function resolvePermissions(roleKey: PermissionKey): Promise<Set<PermissionKey>> {
  const permissions = new Set<PermissionKey>();

  try {
    const supabase = await createServerSupabaseClient();

    const { data: rolePerms, error } = await supabase
      .from("role_permissions")
      .select(
        `
        permission_key,
        roles ( key )
      `
      )
      .eq("roles.key", roleKey);

    if (!error && rolePerms) {
      rolePerms.forEach((rp) => {
        if (rp.permission_key) {
          permissions.add(rp.permission_key as string);
        }
      });

      if (permissions.size > 0) {
        return permissions;
      }
    }
  } catch {
    // Database tables may not exist yet; fall back to static mapping below.
  }

  // Static fallback mapping used until the database tables exist.
  const rolePermissions: Record<string, PermissionKey[]> = {
    owner: [
      "dashboard.view",
      "products.view",
      "products.create",
      "products.update",
      "products.archive",
      "categories.view",
      "categories.manage",
      "inventory.view",
      "inventory.adjust",
      "inventory.transfer",
      "suppliers.view",
      "suppliers.manage",
      "purchases.view",
      "purchases.create",
      "purchases.receive",
      "sales.view",
      "sales.manage",
      "sales.refund",
      "customers.view",
      "customers.manage",
      "expenses.view",
      "expenses.create",
      "expenses.update",
      "finance.view",
      "analytics.view",
      "reports.view",
      "reports.export",
      "locations.view",
      "locations.manage",
      "users.view",
      "users.invite",
      "users.manage_roles",
      "audit_logs.view",
      "settings.view",
      "settings.manage",
    ],
    admin: [
      "dashboard.view",
      "products.view",
      "products.create",
      "products.update",
      "products.archive",
      "categories.view",
      "categories.manage",
      "inventory.view",
      "inventory.adjust",
      "inventory.transfer",
      "suppliers.view",
      "suppliers.manage",
      "purchases.view",
      "purchases.create",
      "purchases.receive",
      "sales.view",
      "sales.manage",
      "sales.refund",
      "customers.view",
      "customers.manage",
      "expenses.view",
      "expenses.create",
      "expenses.update",
      "finance.view",
      "analytics.view",
      "reports.view",
      "reports.export",
      "locations.view",
      "locations.manage",
      "users.view",
      "users.invite",
      "audit_logs.view",
      "settings.view",
      "settings.manage",
    ],
    manager: [
      "dashboard.view",
      "products.view",
      "inventory.view",
      "inventory.adjust",
      "inventory.transfer",
      "suppliers.view",
      "purchases.view",
      "sales.view",
      "sales.manage",
      "sales.refund",
      "customers.view",
      "expenses.view",
      "expenses.create",
      "expenses.update",
      "finance.view",
      "analytics.view",
      "reports.view",
      "locations.view",
      "users.view",
      "settings.view",
    ],
    "inventory_staff": [
      "dashboard.view",
      "products.view",
      "inventory.view",
      "inventory.adjust",
      "inventory.transfer",
      "suppliers.view",
      "purchases.view",
      "sales.view",
      "customers.view",
    ],
    accountant: [
      "dashboard.view",
      "products.view",
      "suppliers.view",
      "purchases.view",
      "sales.view",
      "customers.view",
      "expenses.view",
      "expenses.create",
      "expenses.update",
      "finance.view",
      "reports.view",
      "reports.export",
    ],
    "sales_staff": [
      "dashboard.view",
      "products.view",
      "inventory.view",
      "sales.view",
      "sales.manage",
      "customers.view",
      "customers.manage",
    ],
  };

  const keys = rolePermissions[roleKey] || [];
  keys.forEach((key) => permissions.add(key));

  return permissions;
}
