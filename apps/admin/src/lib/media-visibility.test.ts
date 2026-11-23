import { describe, expect, it } from "vitest";
import {
  canonicalMediaFolder,
  isCanonicalMediaFolder,
  isPublicMediaKey,
  mediaVisibilityForFolder,
  mediaVisibilityForKey,
} from "./media-visibility";

describe("media visibility", () => {
  it("allows only the explicit public folders", () => {
    expect(mediaVisibilityForFolder("products")).toBe("public");
    expect(mediaVisibilityForFolder("banners")).toBe("public");
    expect(mediaVisibilityForFolder("content")).toBe("public");
    for (const folder of ["uploads", "customers", "documents", "internal", "categories", "brands", "fonts", "icons", "videos", "thumbnails", "system"] as const) {
      expect(mediaVisibilityForFolder(folder)).toBe("private");
    }
  });

  it("accepts only exact canonical folder names", () => {
    for (const folder of ["products", "banners", "content", "uploads", "customers", "documents", "internal"]) {
      expect(isCanonicalMediaFolder(folder)).toBe(true);
      expect(canonicalMediaFolder(folder)).toBe(folder);
    }
  });

  it.each([
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
    "prod\u0065cts\u200b",
  ])("rejects invalid folder %j", (folder) => {
    expect(isCanonicalMediaFolder(folder)).toBe(false);
    expect(() => canonicalMediaFolder(folder)).toThrow("Invalid media folder.");
  });

  it("treats legacy and private namespaces as private", () => {
    expect(mediaVisibilityForKey("assets/public/products/image.webp")).toBe("public");
    expect(mediaVisibilityForKey("assets/private/documents/invoice.pdf")).toBe("private");
    expect(mediaVisibilityForKey("assets/uploads/legacy.png")).toBe("private");
  });

  it("rejects traversal and malformed public keys", () => {
    expect(isPublicMediaKey("assets/public/products/image.webp")).toBe(true);
    expect(isPublicMediaKey("assets/public/../private/image.webp")).toBe(false);
    expect(isPublicMediaKey("assets/public/products/")).toBe(false);
  });
});
