import { describe, expect, it } from "vitest";
import {
  isPublicMediaKey,
  mediaVisibilityForFolder,
  mediaVisibilityForKey,
} from "./media-visibility";

describe("media visibility", () => {
  it("allows only the explicit public folders", () => {
    expect(mediaVisibilityForFolder("products")).toBe("public");
    expect(mediaVisibilityForFolder("banners")).toBe("public");
    expect(mediaVisibilityForFolder("content")).toBe("public");
    expect(mediaVisibilityForFolder("documents")).toBe("private");
    expect(mediaVisibilityForFolder("uploads")).toBe("private");
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
