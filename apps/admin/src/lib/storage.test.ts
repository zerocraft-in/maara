import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  initUpload,
  sanitizeAssetFolder,
  sanitizeAssetFilename,
  resetR2ConfigForTesting,
  ASSET_FOLDERS,
  MAX_SIZE_BYTES,
  MIME_TYPES_BY_CATEGORY,
  EXTENSIONS_BY_CATEGORY,
} from "./storage";
import { isPrivateR2SignedUrl } from "./r2";

const originalEnv = {
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
};

afterEach(() => {
  process.env.R2_ACCOUNT_ID = originalEnv.R2_ACCOUNT_ID;
  process.env.R2_ACCESS_KEY_ID = originalEnv.R2_ACCESS_KEY_ID;
  process.env.R2_SECRET_ACCESS_KEY = originalEnv.R2_SECRET_ACCESS_KEY;
  process.env.R2_BUCKET_NAME = originalEnv.R2_BUCKET_NAME;
  resetR2ConfigForTesting();
});

function setR2Env() {
  process.env.R2_ACCOUNT_ID = "acct";
  process.env.R2_ACCESS_KEY_ID = "key";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  process.env.R2_BUCKET_NAME = "maara";
  process.env.R2_CUSTOM_DOMAIN = "https://cdn.maara.co.in";
  resetR2ConfigForTesting();
}

describe("sanitizeAssetFolder", () => {
  it("sanitizes unsafe characters", () => {
    expect(sanitizeAssetFolder("My Products!")).toBe("My_Products");
  });

  it("blocks path traversal", () => {
    expect(sanitizeAssetFolder("../../etc")).toBe("etc");
  });

  it("defaults empty/reserved names to uploads", () => {
    expect(sanitizeAssetFolder("")).toBe("uploads");
    expect(sanitizeAssetFolder("CON")).toBe("uploads");
  });
});

describe("sanitizeAssetFilename", () => {
  it("sanitizes unsafe characters", () => {
    expect(sanitizeAssetFilename("IMG 2026.jpg")).toBe("IMG_2026.jpg");
  });

  it("blocks path traversal", () => {
    expect(sanitizeAssetFilename("../../evil.png")).toBe("evil.png");
  });

  it("preserves extension", () => {
    expect(sanitizeAssetFilename("SCENE_01.png")).toBe("SCENE_01.png");
  });

  it("allows names with extensions even if base is reserved", () => {
    expect(sanitizeAssetFilename("CON.txt")).toBe("CON.txt");
  });

  it("defaults fully reserved names to file", () => {
    expect(sanitizeAssetFilename("CON")).toBe("file");
  });
});

describe("ASSET_FOLDERS", () => {
  it("defines the required canonical folders", () => {
    expect(ASSET_FOLDERS.uploads).toBe("uploads");
    expect(ASSET_FOLDERS.products).toBe("products");
    expect(ASSET_FOLDERS.categories).toBe("categories");
    expect(ASSET_FOLDERS.brands).toBe("brands");
    expect(ASSET_FOLDERS.fonts).toBe("fonts");
    expect(ASSET_FOLDERS.icons).toBe("icons");
    expect(ASSET_FOLDERS.banners).toBe("banners");
    expect(ASSET_FOLDERS.videos).toBe("videos");
    expect(ASSET_FOLDERS.documents).toBe("documents");
    expect(ASSET_FOLDERS.thumbnails).toBe("thumbnails");
    expect(ASSET_FOLDERS.system).toBe("system");
  });
});

describe("MAX_SIZE_BYTES", () => {
  it("defines size limits by category", () => {
    expect(MAX_SIZE_BYTES.image).toBe(15 * 1024 * 1024);
    expect(MAX_SIZE_BYTES.video).toBe(100 * 1024 * 1024);
    expect(MAX_SIZE_BYTES.document).toBe(20 * 1024 * 1024);
    expect(MAX_SIZE_BYTES.font).toBe(10 * 1024 * 1024);
  });
});

describe("MIME_TYPES_BY_CATEGORY", () => {
  it("includes fonts and SVG images", () => {
    expect(MIME_TYPES_BY_CATEGORY.image).toContain("image/svg+xml");
    expect(MIME_TYPES_BY_CATEGORY.font).toContain("font/woff2");
    expect(MIME_TYPES_BY_CATEGORY.font).toContain("font/ttf");
  });
});

describe("EXTENSIONS_BY_CATEGORY", () => {
  it("includes svg and font extensions", () => {
    expect(EXTENSIONS_BY_CATEGORY.image).toContain("svg");
    expect(EXTENSIONS_BY_CATEGORY.font).toContain("woff2");
    expect(EXTENSIONS_BY_CATEGORY.font).toContain("ttf");
  });
});

describe("initUpload", () => {
  beforeEach(() => {
    setR2Env();
  });

  it("generates readable keys with assets root prefix", async () => {
    const result = await initUpload({
      filename: "IMG_20261105_193751112.jpg",
      clientContentType: "image/jpeg",
      size: 1024,
      folder: ASSET_FOLDERS.products,
    });
    expect(result.key).toBe("assets/public/products/IMG_20261105_193751112.jpg");
    expect(result.downloadUrl).toBe("");
    expect(result.deliveryUrl).toBe(`https://cdn.maara.co.in/${result.key}`);
    expect(result.visibility).toBe("public");
    expect(result.uploadUrl).toBeDefined();
    expect(result.contentType).toBe("image/jpeg");
    expect(result.name).toBe("IMG_20261105_193751112.jpg");
    expect(result.folder).toBe("products");
  });

  it("uses original filename without UUID prefix", async () => {
    const result = await initUpload({
      filename: "photo.jpg",
      clientContentType: "image/jpeg",
      size: 1024,
      folder: "products",
    });
    expect(result.key.startsWith("assets/public/products/")).toBe(true);
    expect(result.key).toBe("assets/public/products/photo.jpg");
  });

  it("sanitizes the folder name", async () => {
    const result = await initUpload({
      filename: "file.jpg",
      clientContentType: "image/jpeg",
      size: 1024,
      folder: "My Folder!",
    });
    expect(result.key).toBe("assets/private/My_Folder/file.jpg");
  });

  it("rejects path traversal in filename", async () => {
    const result = await initUpload({
      filename: "../../etc/passwd.jpg",
      clientContentType: "image/jpeg",
      size: 1024,
      folder: "products",
    });
    expect(result.key).not.toContain("..");
    expect(result.key.endsWith("passwd.jpg")).toBe(true);
  });

  it("defaults empty folder to uploads", async () => {
    const result = await initUpload({
      filename: "file.jpg",
      clientContentType: "image/jpeg",
      size: 1024,
      folder: "",
    });
    expect(result.key).toBe("assets/private/uploads/file.jpg");
  });

  it("rejects files with no extension", async () => {
    await expect(
      initUpload({
        filename: "README",
        clientContentType: "text/plain",
        size: 1024,
        folder: "documents",
      }),
    ).rejects.toThrow("recognized extension");
  });

  it("rejects empty files", async () => {
    await expect(
      initUpload({
        filename: "empty.jpg",
        clientContentType: "image/jpeg",
        size: 0,
        folder: "uploads",
      }),
    ).rejects.toThrow("empty");
  });

  it("rejects files over the image size limit", async () => {
    await expect(
      initUpload({
        filename: "big.jpg",
        clientContentType: "image/jpeg",
        size: 16 * 1024 * 1024,
        folder: "uploads",
      }),
    ).rejects.toThrow("too large");
  });

  it("accepts font files under assets/fonts/", async () => {
    const result = await initUpload({
      filename: "maara-sans.woff2",
      clientContentType: "font/woff2",
      size: 50000,
      folder: "fonts",
    });
    expect(result.key).toBe("assets/private/fonts/maara-sans.woff2");
    expect(result.contentType).toBe("font/woff2");
  });

  it("uploadUrl uses R2 S3 endpoint, not CDN domain", async () => {
    const result = await initUpload({
      filename: "photo.jpg",
      clientContentType: "image/jpeg",
      size: 1024,
      folder: "uploads",
    });
    // Presigned PUT URL must point at the R2 S3 API endpoint
    expect(result.uploadUrl).toContain(".r2.cloudflarestorage.com/");
    expect(result.uploadUrl).not.toContain("cdn.maara.co.in");
    expect(result.uploadUrl).toContain(result.key);
  });

  it("downloadUrl is a signed private URL", async () => {
    const result = await initUpload({
      filename: "photo.jpg",
      clientContentType: "image/jpeg",
      size: 1024,
      folder: "uploads",
    });
    expect(result.downloadUrl).toContain("X-Amz-Signature");
    expect(result.downloadUrl).toContain(result.key);
    expect(isPrivateR2SignedUrl(result.downloadUrl, result.key)).toBe(true);
  });

  it("rejects custom-domain and unsigned download URLs", () => {
    expect(
      isPrivateR2SignedUrl(
        "https://cdn.maara.co.in/assets/uploads/photo.jpg",
        "assets/uploads/photo.jpg",
      ),
    ).toBe(false);
    expect(
      isPrivateR2SignedUrl(
        "https://acct.r2.cloudflarestorage.com/assets/uploads/photo.jpg",
        "assets/uploads/photo.jpg",
      ),
    ).toBe(false);
  });

  it("uploadUrl and downloadUrl are different signed operations", async () => {
    const result = await initUpload({
      filename: "photo.jpg",
      clientContentType: "image/jpeg",
      size: 1024,
      folder: "uploads",
    });
    expect(result.uploadUrl).not.toBe(result.downloadUrl);
  });

  it("signed contentType matches the client-supplied MIME type for known types", async () => {
    const result = await initUpload({
      filename: "photo.png",
      clientContentType: "image/png",
      size: 1024,
      folder: "uploads",
    });
    expect(result.contentType).toBe("image/png");
  });

  it("signed contentType falls back to category default when client MIME is empty", async () => {
    const result = await initUpload({
      filename: "photo.jpg",
      clientContentType: "",
      size: 1024,
      folder: "uploads",
    });
    expect(result.contentType).toBe("image/jpeg");
  });

  it("rejects video files over 100 MB", async () => {
    await expect(
      initUpload({
        filename: "big.mp4",
        clientContentType: "video/mp4",
        size: 101 * 1024 * 1024,
        folder: "videos",
      }),
    ).rejects.toThrow("too large");
  });

  it("accepts WebP images", async () => {
    const result = await initUpload({
      filename: "photo.webp",
      clientContentType: "image/webp",
      size: 1024,
      folder: "uploads",
    });
    expect(result.contentType).toBe("image/webp");
    expect(result.key.endsWith(".webp")).toBe(true);
  });
});
