"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { deleteFile } from "@/lib/r2";
import { verifyR2Object } from "@/lib/file-policy";

export type MediaResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

// ============================================================================
// Media Actions
// ============================================================================

const mediaFileSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "File key is required")
    .max(1024, "File key must be at most 1024 characters"),
  name: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name must be at most 255 characters"),
  contentType: z
    .string()
    .trim()
    .max(200, "Content type must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  sizeBytes: z
    .number()
    .int()
    .nonnegative("File size must be zero or greater"),
  url: z.string().trim().max(2048).optional().or(z.literal("")),
});

export async function registerMediaFile(input: unknown): Promise<MediaResult> {
  const context = await requirePermission("media.create");
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  const parseResult = mediaFileSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid media file data.",
    };
  }

  const { key, name, contentType, sizeBytes } = parseResult.data;

  // Registration is the second authorization boundary after upload-init.
  // Never allow a caller to attach arbitrary bucket paths to its metadata.
  if (
    !/^assets\/(?:public|private)\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(key) &&
    !/^assets\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(key) ||
    key.includes("..") ||
    key.startsWith("/")
  ) {
    return { ok: false, error: "Invalid storage object key." };
  }

  const supabase = await createServerSupabaseClient();

  const objectVerified = await verifyR2Object({
    key,
    expectedContentType: contentType || "application/octet-stream",
  });
  if (!objectVerified) {
    try {
      await deleteFile({ key });
    } catch (cleanupError) {
      console.error("Failed to clean up unverified R2 object:", {
        key,
        error: cleanupError instanceof Error ? cleanupError.message : "unknown",
      });
    }
    return { ok: false, error: "Uploaded object could not be verified." };
  }

  const { data, error } = await supabase.rpc("create_media", {
    p_organization_id: organization.id,
    p_key: key,
    p_name: name,
    p_content_type: contentType ?? null,
    p_size_bytes: sizeBytes,
    p_url: `r2://${key}`,
  });

  if (error) {
    // Registration failed after a (likely) successful R2 upload. Attempt a
    // compensating deletion of the R2 object so we do not leave an orphaned
    // object whose only reference (the key) we are about to discard.
    console.error("Register media file RPC error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      key,
    });

    try {
      await deleteFile({ key });
      console.error("Compensating R2 deletion attempted for failed registration:", {
        key,
      });
    } catch (r2Err) {
      // Preserve diagnostic information to identify the orphaned object.
      console.error("Compensating R2 deletion also failed:", {
        key,
        r2Message: r2Err instanceof Error ? r2Err.message : String(r2Err),
      });
    }

    return {
      ok: false,
      error:
        error.message ?? "Failed to register media file. The uploaded file may still exist in storage.",
    };
  }

  revalidatePath("/content/files");

  return { ok: true, id: data as string };
}

const renameMediaSchema = z.object({
  mediaId: z.string().uuid("Invalid media file ID."),
  name: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name must be at most 255 characters"),
});

export async function renameMediaFile(input: unknown): Promise<MediaResult> {
  const context = await requirePermission("media.update");
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  const parseResult = renameMediaSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid rename data.",
    };
  }

  const { mediaId, name } = parseResult.data;

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("update_media", {
    p_media_id: mediaId,
    p_name: name,
  });

  if (error) {
    console.error("Rename media file RPC error:", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return { ok: false, error: error.message ?? "Failed to rename media file." };
  }

  revalidatePath("/content/files");

  return { ok: true };
}

const deleteMediaSchema = z.object({
  mediaId: z.string().uuid("Invalid media file ID."),
});

export async function deleteMediaFile(input: unknown): Promise<MediaResult> {
  const context = await requirePermission("media.delete");
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  const parseResult = deleteMediaSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid delete data.",
    };
  }

  const { mediaId } = parseResult.data;

  const supabase = await createServerSupabaseClient();

  // Fetch the record first so we know the R2 key (needed for compensating
  // cleanup) and can verify organization ownership.
  const { data: file, error: fetchError } = await supabase
    .from("media")
    .select("id, key, organization_id")
    .eq("id", mediaId)
    .single();

  if (fetchError || !file) {
    return { ok: false, error: "Media file not found." };
  }

  if (file.organization_id !== organization.id) {
    return { ok: false, error: "Forbidden." };
  }

  // Reliable delete: delete the R2 object first, then the database record.
  // Deleting the DB record first would lose the only reference (the key) to
  // an object R2 failed to delete, creating an unreachable orphan.
  if (file.key) {
    try {
      await deleteFile({ key: file.key });
    } catch (r2Err) {
      console.error("R2 delete failed, aborting DB delete:", {
        mediaId,
        key: file.key,
        r2Message: r2Err instanceof Error ? r2Err.message : String(r2Err),
      });
      return {
        ok: false,
        error:
          "Failed to delete file from storage. The database record was not removed. Try again.",
      };
    }
  }

  // Use the SECURITY DEFINER RPC for the database deletion. This runs with
  // the function owner's privileges and performs its own permission checks,
  // avoiding RLS/auth context issues that can occur with direct client
  // deletions from Server Actions.
  const { error: dbError } = await supabase.rpc("delete_media", {
    p_media_id: mediaId,
  });

  if (dbError) {
    // R2 object deleted but DB delete failed. The R2 delete of a missing
    // object is idempotent, so retrying the DB deletion is safe. Return a
    // clear error so the client can retry.
    console.error("DB delete failed after R2 removal:", {
      mediaId,
      key: file.key,
      code: dbError.code,
      message: dbError.message,
    });
    return {
      ok: false,
      error:
        "File removed from storage but metadata could not be cleared. Try again.",
    };
  }

  revalidatePath("/content/files");

  return { ok: true };
}
