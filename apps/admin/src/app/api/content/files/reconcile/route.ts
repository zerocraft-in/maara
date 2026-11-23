/**
 * POST /api/content/files/reconcile
 *
 * Reconciles orphaned media metadata: finds media records whose R2 object
 * no longer exists and removes the stale metadata. Requires media.delete
 * permission and verifies organization ownership for each record.
 *
 * Body: { dryRun?: boolean } - if true, only reports what would be reconciled
 * without actually deleting anything.
 */
import { NextResponse } from "next/server";
import {
  requirePermission,
  requireRoles,
  requireOrganization,
} from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { headObject } from "@/lib/r2";
import { requestIdFrom } from "@/lib/http";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    await requirePermission("media.delete");
    await requireRoles("admin", "owner", "manager");

    const organizationId = (await resolveOrganization()).id;
    const body = await request.json();
    const { dryRun = false } = body || {};

    const supabase = await createServerSupabaseClient();

    // Fetch all media records for the organization.
    const { data: files, error: fetchError } = await supabase
      .from("media")
      .select("id, key, name, organization_id")
      .eq("organization_id", organizationId);

    if (fetchError) {
      console.error("Media reconcile fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to list media" }, { status: 500 });
    }

    const reconciled: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const file of files ?? []) {
      // Check if the R2 object still exists.
      const metadata = await headObject({ key: file.key });

      if (metadata !== null) {
        // Object still exists, nothing to reconcile.
        continue;
      }

      // Object is missing from R2 but metadata exists. Delete the metadata.
      if (dryRun) {
        reconciled.push(file.id);
        continue;
      }

      const { error: deleteError } = await supabase.rpc("delete_media", {
        p_media_id: file.id,
      });

      if (deleteError) {
        errors.push({ id: file.id, error: deleteError.message });
        continue;
      }

      reconciled.push(file.id);
    }

    return NextResponse.json({
      ok: true,
      reconciled: reconciled.length,
      reconciledIds: reconciled,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error("Media reconcile error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to reconcile media";
    const status = message === "Unauthenticated" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to reconcile media." : message },
      { status, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } },
    );
  }
}

/**
 * Resolve the caller's active organization from the session (never client input).
 */
async function resolveOrganization(): Promise<{
  readonly id: string;
  readonly slug: string;
}> {
  const context = await requireOrganization();
  if (!context.activeOrganization) {
    throw new Error("No active organization");
  }
  return {
    id: context.activeOrganization.id,
    slug: context.activeOrganization.slug,
  };
}
