import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
  type SessionContext,
} from "@/lib/auth/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PAGE_SIZE = 25;

// Hard upper bound for the `page` query parameter. Together with PAGE_SIZE it
// keeps the PostgREST offset inside a safe integer range.
const MAX_PAGE = 10_000;

type AuditLogRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const ACTION_LABELS: Record<string, string> = {
  "organization.settings_changed": "Organization settings changed",
  "member.invited": "Member invited",
  "invitation.accepted": "Invitation accepted",
  "member.role_changed": "Member role changed",
  "category.created": "Category created",
  "category.updated": "Category updated",
  "category.archived": "Category archived",
  "category.status_changed": "Category status changed",
  "product.created": "Product created",
  "product.updated": "Product updated",
  "product.archived": "Product archived",
  "product.status_changed": "Product status changed",
  "variant.created": "Variant created",
  "variant.updated": "Variant updated",
  "variant.status_changed": "Variant status changed",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function actionVariant(action: string): "default" | "success" | "outline" {
  switch (action) {
    case "member.invited":
    case "invitation.accepted":
    case "category.created":
    case "product.created":
    case "variant.created":
      return "success";
    case "category.archived":
    case "product.archived":
      return "outline";
    default:
      return "default";
  }
}

function renderMetadata(action: string, metadata: unknown): React.ReactNode {
  const m = metadata as Record<string, unknown> | null | undefined;
  if (!m || typeof m !== "object") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "organization.settings_changed") {
    const columns = m.changed_columns;
    if (Array.isArray(columns) && columns.length > 0) {
      return (
        <span className="text-xs text-body">
          {String(columns.join(", "))}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "member.invited") {
    const email = m.email;
    const role = m.role_key;
    if (typeof email === "string") {
      return (
        <span className="text-xs text-body">
          {email} as {String(role ?? "—")}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "invitation.accepted") {
    const email = m.email;
    if (typeof email === "string") {
      return <span className="text-xs text-body">{email}</span>;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "member.role_changed") {
    const oldRole = m.old_role_key;
    const newRole = m.new_role_key;
    if (typeof oldRole === "string" && typeof newRole === "string") {
      return (
        <span className="text-xs text-body">
          {oldRole} → {newRole}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "category.created") {
    const name = m.name;
    if (typeof name === "string") {
      return <span className="text-xs text-body">{name}</span>;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "category.updated") {
    const columns = m.changed_columns;
    if (Array.isArray(columns) && columns.length > 0) {
      return (
        <span className="text-xs text-body">
          {String(columns.join(", "))}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "category.archived") {
    const status = m.status;
    if (typeof status === "string") {
      return <span className="text-xs text-body">{status}</span>;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "category.status_changed") {
    const oldStatus = m.old_status;
    const newStatus = m.new_status;
    if (typeof oldStatus === "string" && typeof newStatus === "string") {
      return (
        <span className="text-xs text-body">
          {oldStatus} → {newStatus}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "product.created") {
    const name = m.name;
    const status = m.status;
    if (typeof name === "string") {
      return (
        <span className="text-xs text-body">
          {name}
          {typeof status === "string" ? ` (${status})` : ""}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "product.updated" || action === "variant.updated") {
    const columns = m.changed_columns;
    if (Array.isArray(columns) && columns.length > 0) {
      return (
        <span className="text-xs text-body">
          {String(columns.join(", "))}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "product.archived") {
    const status = m.status;
    if (typeof status === "string") {
      return <span className="text-xs text-body">{status}</span>;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "product.status_changed") {
    const oldStatus = m.old_status;
    const newStatus = m.new_status;
    if (typeof oldStatus === "string" && typeof newStatus === "string") {
      return (
        <span className="text-xs text-body">
          {oldStatus} → {newStatus}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "variant.created") {
    const sku = m.sku;
    if (typeof sku === "string") {
      return <span className="text-xs text-body">{sku}</span>;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (action === "variant.status_changed") {
    const oldActive = m.old_is_active;
    const newActive = m.new_is_active;
    if (typeof oldActive === "boolean" && typeof newActive === "boolean") {
      const format = (value: boolean) => (value ? "active" : "inactive");
      return (
        <span className="text-xs text-body">
          {format(oldActive)} → {format(newActive)}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}

/**
 * Parses the `page` query parameter strictly.
 *
 * Only a single value made of ASCII digits is accepted, starting at 1. Query
 * arrays (`?page=1&page=2`), signs, whitespace, decimals, leading zeros and
 * values above MAX_PAGE all fall back to page 1 instead of reaching PostgREST.
 */
function parsePageParam(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  if (!Number.isSafeInteger(page) || page > MAX_PAGE) {
    return 1;
  }

  return page;
}

/**
 * Resolves the verified session context for the active organization.
 *
 * Only the "no active membership" case is turned into a redirect to
 * onboarding. Authentication and database failures are re-thrown so they are
 * never masked as a missing membership.
 */
async function requireOrganizationOrRedirect(): Promise<SessionContext> {
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

async function fetchAuditLogs(
  supabase: SupabaseClient,
  organizationId: string,
  page: number,
): Promise<{
  logs: AuditLogRow[];
  hasNextPage: boolean;
}> {
  const offset = (page - 1) * PAGE_SIZE;

  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE);

  if (error) throw error;

  const rows = (data ?? []) as unknown as AuditLogRow[];
  const hasNextPage = rows.length > PAGE_SIZE;
  const logs = rows.slice(0, PAGE_SIZE);

  return { logs, hasNextPage };
}

async function fetchActorNames(
  supabase: SupabaseClient,
  actorIds: string[],
): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  const uniqueIds = Array.from(new Set(actorIds.filter((id) => Boolean(id))));
  if (uniqueIds.length === 0) return names;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueIds);

  if (error) {
    console.error("Actor profile lookup failed.", {
      code: error.code,
      message: error.message,
    });
    return names;
  }

  const rows = (data ?? []) as unknown as ProfileRow[];
  for (const row of rows) {
    names.set(row.id, row.full_name ?? null);
  }

  return names;
}

/**
 * Returns the organization's IANA timezone when it is readable and valid.
 *
 * The page is still usable without it, so any failure (RLS, network, invalid
 * stored value) logs and returns undefined rather than failing the request.
 */
async function fetchOrganizationTimeZone(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("Organization timezone lookup failed.", {
      code: error.code,
      message: error.message,
    });
    return undefined;
  }

  const timezone = (data as { timezone?: unknown } | null)?.timezone;
  if (typeof timezone !== "string" || timezone.trim() === "") {
    return undefined;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return undefined;
  }
}

function formatEventTime(
  createdAt: string,
  timeZone: string | undefined,
): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export default async function AuditLogsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = parsePageParam(params.page);

  const context = await requireOrganizationOrRedirect();

  const organizationId = context.activeOrganization?.id;
  if (!organizationId) {
    redirect("/onboarding");
  }

  if (!context.permissions.has("audit_logs.view")) {
    redirect("/overview");
  }

  const supabase: SupabaseClient = await createServerSupabaseClient();

  let logs: AuditLogRow[] = [];
  let hasNextPage = false;
  let timeZone: string | undefined;
  let errorMessage: string | null = null;

  try {
    const [result, organizationTimeZone] = await Promise.all([
      fetchAuditLogs(supabase, organizationId, page),
      fetchOrganizationTimeZone(supabase, organizationId),
    ]);
    logs = result.logs;
    hasNextPage = result.hasNextPage;
    timeZone = organizationTimeZone;
  } catch (error) {
    const err = error as { code?: string; message?: string } | undefined;
    console.error("Audit logs load failed.", {
      code: err?.code,
      message: err?.message ?? String(error),
    });
    errorMessage = "Unable to load audit logs. Please try again.";
  }

  const actorIds = logs
    .map((row) => row.actor_user_id)
    .filter((id): id is string => Boolean(id));
  const actorNames = await fetchActorNames(supabase, actorIds);

  const countLabel =
    logs.length === 0
      ? "No events on this page"
      : `${logs.length} ${logs.length === 1 ? "event" : "events"} on this page`;
  const descriptionParts = [countLabel, `Page ${page}`];
  if (timeZone) {
    descriptionParts.push(`Times in ${timeZone}`);
  }

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
              Audit Logs
            </h2>
            <p className="hidden text-2xs text-meta sm:block">
              Organization activity history
            </p>
          </div>
        </div>
      </div>

      <Separator className="mt-4 mb-8" />

      {errorMessage ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-body">{errorMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Activity</CardTitle>
                <CardDescription>{descriptionParts.join(" · ")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left pb-3 whitespace-nowrap">Time</th>
                      <th className="text-left pb-3">Actor</th>
                      <th className="text-left pb-3">Action</th>
                      <th className="text-left pb-3">Entity</th>
                      <th className="text-left pb-3">Entity ID</th>
                      <th className="text-left pb-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          {page > 1
                            ? "No audit log entries on this page."
                            : "No audit log entries yet."}
                        </td>
                      </tr>
                    ) : (
                      logs.map((row: AuditLogRow) => {
                        // Only a null actor means the event was system
                        // generated. A missing profile must not be labelled
                        // as "System".
                        const actorName = !row.actor_user_id
                          ? "System"
                          : actorNames.get(row.actor_user_id) || "Unknown user";
                        const actorInitial = (
                          actorName.charAt(0) || "?"
                        ).toUpperCase();
                        const time = formatEventTime(row.created_at, timeZone);
                        const entityId = row.entity_id
                          ? String(row.entity_id).slice(0, 8) + "…"
                          : "—";

                        return (
                          <tr key={row.id} className="border-b">
                            <td className="py-3 text-muted-foreground whitespace-nowrap">
                              {time}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-inset text-[10px] font-bold text-body">
                                  {actorInitial}
                                </div>
                                <div className="flex flex-col leading-none">
                                  <p className="text-sm font-semibold">
                                    {actorName}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3">
                              <Badge variant={actionVariant(row.action)}>
                                {actionLabel(row.action)}
                              </Badge>
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {row.entity_type}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {row.entity_id ? (
                                <span title={String(row.entity_id)}>
                                  {entityId}
                                </span>
                              ) : (
                                entityId
                              )}
                            </td>
                            <td className="py-3">
                              {renderMetadata(row.action, row.metadata)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex items-center justify-between">
            {page > 1 ? (
              <Link
                href={`/audit-logs?page=${page - 1}`}
                className="text-xs text-brand-text hover:underline"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {hasNextPage ? (
              <Link
                href={`/audit-logs?page=${page + 1}`}
                className="text-xs text-brand-text hover:underline"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </>
      )}
    </div>
  );
}
