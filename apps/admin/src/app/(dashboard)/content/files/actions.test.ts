import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  supabaseClient,
  deleteFileMock,
  requirePermissionMock,
  verifyR2ObjectMock,
} = vi.hoisted(
  () => ({
    supabaseClient: {
      rpc: vi.fn(),
      from: vi.fn(),
    },
    deleteFileMock: vi.fn(),
    requirePermissionMock: vi.fn(),
    verifyR2ObjectMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => supabaseClient,
}));

vi.mock("@/lib/r2", () => ({
  deleteFile: deleteFileMock,
}));

vi.mock("@/lib/file-policy", () => ({
  verifyR2Object: verifyR2ObjectMock,
}));

vi.mock("@/lib/auth/session", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { registerMediaFile, deleteMediaFile, renameMediaFile } from "./actions";
import { deleteFile } from "@/lib/r2";

type SessionCtx = {
  user: { id: string; email: string | null };
  memberships: never[];
  activeOrganization: { id: string; name: string; slug: string };
  permissions: Set<string>;
};

let permissionCtx: SessionCtx | null = null;
requirePermissionMock.mockImplementation(async (permission: string) => {
  if (!permissionCtx || !permissionCtx.permissions.has(permission)) {
    throw new Error("Forbidden");
  }
  return permissionCtx;
});

function sessionMock(permissions: Set<string>, organizationId = "org-1") {
  permissionCtx = {
    user: { id: "user-1", email: "u@example.com" },
    memberships: [],
    activeOrganization: { id: organizationId, name: "Org", slug: "org" },
    permissions,
  };
}

describe("registerMediaFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    permissionCtx = null;
    verifyR2ObjectMock.mockResolvedValue(true);
    requirePermissionMock.mockImplementation(async (permission: string) => {
      if (!permissionCtx || !permissionCtx.permissions.has(permission)) {
        throw new Error("Forbidden");
      }
      return permissionCtx;
    });
  });

  it("registers media and returns the id on success", async () => {
    sessionMock(new Set(["media.create"]));
    vi.mocked(supabaseClient.rpc).mockResolvedValue({
      data: "media-1",
      error: null,
    });

    const result = await registerMediaFile({
      key: "assets/uploads/uuid-photo.jpg",
      name: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024,
      url: "r2://assets/uploads/uuid-photo.jpg",
    });

    expect(result.ok).toBe(true);
    expect((result as { ok: true; id: string }).id).toBe("media-1");
    expect(supabaseClient.rpc).toHaveBeenCalledWith("create_media", {
      p_organization_id: "org-1",
      p_key: "assets/uploads/uuid-photo.jpg",
      p_name: "photo.jpg",
      p_content_type: "image/jpeg",
      p_size_bytes: 1024,
      p_url: "r2://assets/uploads/uuid-photo.jpg",
    });
  });

  it("attempts compensating R2 deletion when registration fails", async () => {
    sessionMock(new Set(["media.create"]));
    const dbError = new Error("insert failed");
    (dbError as { code?: string }).code = "23505";
    vi.mocked(supabaseClient.rpc).mockResolvedValue({
      data: null,
      error: dbError,
    });
    vi.mocked(deleteFile).mockResolvedValue(undefined);

    const result = await registerMediaFile({
      key: "assets/uploads/uuid-photo.jpg",
      name: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024,
      url: "r2://assets/uploads/uuid-photo.jpg",
    });

    expect(result.ok).toBe(false);
    expect(deleteFile).toHaveBeenCalledWith({
      key: "assets/uploads/uuid-photo.jpg",
    });
  });

  it("cleans up an object when post-upload verification fails", async () => {
    sessionMock(new Set(["media.create"]));
    verifyR2ObjectMock.mockResolvedValue(false);
    vi.mocked(deleteFile).mockResolvedValue(undefined);

    const result = await registerMediaFile({
      key: "assets/uploads/uuid-photo.jpg",
      name: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024,
      url: "r2://assets/uploads/uuid-photo.jpg",
    });

    expect(result).toEqual({
      ok: false,
      error: "Uploaded object could not be verified.",
    });
    expect(deleteFile).toHaveBeenCalledWith({
      key: "assets/uploads/uuid-photo.jpg",
    });
    expect(supabaseClient.rpc).not.toHaveBeenCalled();
  });

  it("rejects missing media.create permission", async () => {
    sessionMock(new Set(["media.view"]));
    await expect(
      registerMediaFile({ key: "k", name: "n", sizeBytes: 1, url: "u" }),
    ).rejects.toThrow("Forbidden");
  });
});

describe("deleteMediaFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    permissionCtx = null;
    requirePermissionMock.mockImplementation(async (permission: string) => {
      if (!permissionCtx || !permissionCtx.permissions.has(permission)) {
        throw new Error("Forbidden");
      }
      return permissionCtx;
    });
  });

  it("deletes R2 object first, then DB record via RPC", async () => {
    sessionMock(new Set(["media.delete"]));
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "m-1",
          key: "assets/uploads/uuid-photo.jpg",
          organization_id: "org-1",
        },
        error: null,
      }),
    };
    vi.mocked(supabaseClient.from).mockReturnValue(fromMock);
    vi.mocked(supabaseClient.rpc).mockResolvedValue({ error: null });

    const result = await deleteMediaFile({ mediaId: "123e4567-e89b-12d3-a456-426614174000" });

    expect(result.ok).toBe(true);
    expect(deleteFile).toHaveBeenCalledWith({
      key: "assets/uploads/uuid-photo.jpg",
    });
    expect(supabaseClient.rpc).toHaveBeenCalledWith("delete_media", {
      p_media_id: "123e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("aborts DB delete when R2 deletion fails", async () => {
    sessionMock(new Set(["media.delete"]));
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "m-1",
          key: "assets/uploads/uuid-photo.jpg",
          organization_id: "org-1",
        },
        error: null,
      }),
    };
    vi.mocked(supabaseClient.from).mockReturnValue(fromMock);
    vi.mocked(deleteFile).mockRejectedValue(new Error("R2 down"));

    const result = await deleteMediaFile({ mediaId: "123e4567-e89b-12d3-a456-426614174000" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Failed to delete file from storage. The database record was not removed. Try again.");
    }
    expect(supabaseClient.rpc).not.toHaveBeenCalledWith("delete_media", expect.anything());
  });

  it("reports error when DB delete fails after R2 deletion", async () => {
    sessionMock(new Set(["media.delete"]));
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "m-1",
          key: "assets/uploads/uuid-photo.jpg",
          organization_id: "org-1",
        },
        error: null,
      }),
    };
    vi.mocked(supabaseClient.from).mockReturnValue(fromMock);
    vi.mocked(deleteFile).mockResolvedValue(undefined);
    vi.mocked(supabaseClient.rpc).mockResolvedValue({ error: new Error("DB error") });

    const result = await deleteMediaFile({ mediaId: "123e4567-e89b-12d3-a456-426614174000" });

    if (!result.ok) {
      expect(result.error).toBe("File removed from storage but metadata could not be cleared. Try again.");
    } else {
      throw new Error("Expected result to be not ok");
    }
    expect(supabaseClient.rpc).toHaveBeenCalledWith("delete_media", {
      p_media_id: "123e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("rejects missing media record", async () => {
    sessionMock(new Set(["media.delete"]));
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Not found"),
      }),
    };
    vi.mocked(supabaseClient.from).mockReturnValue(fromMock);

    const result = await deleteMediaFile({ mediaId: "123e4567-e89b-12d3-a456-426614174000" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Media file not found.");
    }
    expect(deleteFile).not.toHaveBeenCalled();
    expect(supabaseClient.rpc).not.toHaveBeenCalled();
  });

  it("rejects cross-organization deletion", async () => {
    sessionMock(new Set(["media.delete"]));
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "m-1",
          key: "org-2/uuid-photo.jpg",
          organization_id: "org-2",
        },
        error: null,
      }),
    };
    vi.mocked(supabaseClient.from).mockReturnValue(fromMock);

    const result = await deleteMediaFile({ mediaId: "123e4567-e89b-12d3-a456-426614174000" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Forbidden.");
    }
    expect(deleteFile).not.toHaveBeenCalled();
    expect(supabaseClient.rpc).not.toHaveBeenCalled();
  });

  it("rejects missing media.delete permission", async () => {
    sessionMock(new Set(["media.view"]));
    await expect(
      deleteMediaFile({ mediaId: "123e4567-e89b-12d3-a456-426614174000" }),
    ).rejects.toThrow("Forbidden");
  });
});

describe("renameMediaFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    permissionCtx = null;
    requirePermissionMock.mockImplementation(async (permission: string) => {
      if (!permissionCtx || !permissionCtx.permissions.has(permission)) {
        throw new Error("Forbidden");
      }
      return permissionCtx;
    });
  });

  it("renames via update_media RPC", async () => {
    sessionMock(new Set(["media.update"]));
    vi.mocked(supabaseClient.rpc).mockResolvedValue({ error: null });

    const result = await renameMediaFile({
      mediaId: "123e4567-e89b-12d3-a456-426614174000",
      name: "new-name.jpg",
    });

    expect(result.ok).toBe(true);
    expect(supabaseClient.rpc).toHaveBeenCalledWith("update_media", {
      p_media_id: "123e4567-e89b-12d3-a456-426614174000",
      p_name: "new-name.jpg",
    });
  });

  it("rejects missing media.update permission", async () => {
    sessionMock(new Set(["media.view"]));
    await expect(
      renameMediaFile({ mediaId: "m-1", name: "n.jpg" }),
    ).rejects.toThrow("Forbidden");
  });
});
