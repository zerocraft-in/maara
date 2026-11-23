import { beforeEach, describe, expect, it, vi } from "vitest";

const { initUploadMock, requirePermissionMock, requireRolesMock, isPrivateSignedUrlMock } = vi.hoisted(() => ({
  initUploadMock: vi.fn(),
  requirePermissionMock: vi.fn(),
  requireRolesMock: vi.fn(),
  isPrivateSignedUrlMock: vi.fn(() => true),
}));

vi.mock("@/lib/auth/session", () => ({
  requirePermission: requirePermissionMock,
  requireRoles: requireRolesMock,
  requireOrganization: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  ASSET_FOLDERS: { uploads: "uploads" },
  initUpload: initUploadMock,
  sanitizeAssetFilename: vi.fn((name: string) => name),
}));

vi.mock("@/lib/r2", () => ({
  deleteFile: vi.fn(),
  getObjectUrl: vi.fn(),
  getPublicCdnUrl: vi.fn(),
  isPrivateR2SignedUrl: isPrivateSignedUrlMock,
  renameFile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  requestIdFrom: vi.fn(() => "test-request"),
}));

import { POST } from "./route";

describe("POST /api/content/files canonical folder validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue(undefined);
    requireRolesMock.mockResolvedValue(undefined);
  });

  it.each([
    "unknown",
    "",
    " ",
    " products",
    "products ",
    "PRODUCTS",
    "../products",
    "products/../uploads",
    "products\\uploads",
    "products%2Fuploads",
    "..%2Fproducts",
    "%252e%252e%252fproducts",
    "products\0",
    "products%00",
    "products\u200b",
  ])("rejects invalid folder %j before signing or storage access", async (folder) => {
    const response = await POST(
      new Request("https://admin.example/api/content/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "photo.png",
          contentType: "image/png",
          size: 100,
          folder,
          visibility: "public",
          key: "assets/public/products/attacker.png",
          bucket: "attacker-bucket",
          organizationId: "attacker-org",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid media folder." });
    expect(initUploadMock).not.toHaveBeenCalled();
    expect(isPrivateSignedUrlMock).not.toHaveBeenCalled();
  });

  it.each([
    ["products", "public", "assets/public/products/photo.png"],
    ["banners", "public", "assets/public/banners/photo.png"],
    ["content", "public", "assets/public/content/photo.png"],
    ["uploads", "private", "assets/private/uploads/photo.png"],
    ["customers", "private", "assets/private/customers/photo.png"],
    ["documents", "private", "assets/private/documents/photo.png"],
    ["internal", "private", "assets/private/internal/photo.png"],
  ])("passes canonical folder %s without client overrides", async (folder, visibility, key) => {
    initUploadMock.mockResolvedValue({
      key,
      name: "photo.png",
      contentType: "image/png",
      size: 100,
      category: "image",
      folder,
      uploadUrl: "https://r2.example/signed-put",
      visibility,
      deliveryUrl: visibility === "public" ? `https://cdn.example/${key}` : "https://r2.example/signed-get",
      downloadUrl: "https://r2.example/signed-get",
      expiresIn: 900,
    });

    const response = await POST(
      new Request("https://admin.example/api/content/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "photo.png",
          contentType: "image/png",
          size: 100,
          folder,
          visibility: "private",
          key: "assets/private/uploads/attacker.png",
          bucket: "attacker-bucket",
          organizationId: "attacker-org",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(initUploadMock).toHaveBeenCalledWith({
      filename: "photo.png",
      clientContentType: "image/png",
      size: 100,
      folder,
    });
  });
});
