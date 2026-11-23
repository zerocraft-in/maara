import { describe, expect, it } from "vitest";
import worker, { keyFromRequest } from "./index";

function object(body = "ok") {
  return {
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } }),
    httpMetadata: { contentType: "image/png" },
    httpEtag: '"abc"',
    size: body.length,
  };
}

function bucketFor(objects: Record<string, ReturnType<typeof object>>) {
  return {
    get: async (key: string) => objects[key] ?? null,
    head: async (key: string) => objects[key] ? { ...objects[key], body: undefined } : null,
  };
}

describe("public CDN worker", () => {
  it("accepts only public namespace keys", () => {
    expect(keyFromRequest(new Request("https://cdn.example/assets/public/products/a.png"))).toBe("assets/public/products/a.png");
    expect(keyFromRequest(new Request("https://cdn.example/assets/private/products/a.png"))).toBeNull();
    expect(keyFromRequest(new Request("https://cdn.example/assets/public/../private/a.png"))).toBeNull();
  });

  it("serves public GET with trusted metadata and immutable cache", async () => {
    const env = { PUBLIC_MEDIA: bucketFor({ "assets/public/products/a.png": object() }) } as never;
    const response = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
  });

  it("supports HEAD and conditional requests", async () => {
    const env = { PUBLIC_MEDIA: bucketFor({ "assets/public/products/a.png": object() }) } as never;
    const head = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", { method: "HEAD" }), env);
    expect(head.status).toBe(200);
    const notModified = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", { headers: { "If-None-Match": '"abc"' } }), env);
    expect(notModified.status).toBe(304);
  });

  it.each(["POST", "OPTIONS", "PUT"]) ("rejects %s", async (method) => {
    const response = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", { method }), { PUBLIC_MEDIA: bucketFor({}) } as never);
    expect(response.status).toBe(405);
  });

  it("returns 404 for private, listing, malformed, and missing paths", async () => {
    const env = { PUBLIC_MEDIA: bucketFor({}) } as never;
    for (const path of ["assets/private/docs/a.pdf", "", "assets/public/products/missing.png", "assets/public/%E0%A4%A.png"]) {
      const response = await worker.fetch(new Request(`https://cdn.example/${path}`), env);
      expect(response.status).toBe(404);
    }
  });
});
