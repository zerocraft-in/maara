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

function bucketFor(
  objects: Record<string, ReturnType<typeof object>>,
  calls: { get: number; head: number } = { get: 0, head: 0 },
) {
  return {
    get: async (key: string) => {
      calls.get += 1;
      return objects[key] ?? null;
    },
    head: async (key: string) => {
      calls.head += 1;
      return objects[key] ? { ...objects[key], body: undefined } : null;
    },
  };
}

describe("public CDN worker", () => {
  it("accepts only public namespace keys", () => {
    expect(keyFromRequest(new Request("https://cdn.example/assets/public/products/a.png"))).toBe("assets/public/products/a.png");
    expect(keyFromRequest(new Request("https://cdn.example/assets/private/products/a.png"))).toBeNull();
    expect(keyFromRequest(new Request("https://cdn.example/assets/public/../private/a.png"))).toBeNull();
    expect(keyFromRequest(new Request("https://cdn.example/assets/public/products/%00.png"))).toBeNull();
    expect(keyFromRequest(new Request("https://cdn.example/assets/public/products/%2500.png"))).toBeNull();
  });

  it("serves public GET with trusted metadata and immutable cache", async () => {
    const env = { PUBLIC_MEDIA: bucketFor({ "assets/public/products/a.png": object() }) } as never;
    const response = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", {
      headers: { Origin: "https://admin.maara.co.in" },
    }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://admin.maara.co.in");
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe("ETag");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("supports HEAD with CORS and no response body", async () => {
    const env = { PUBLIC_MEDIA: bucketFor({ "assets/public/products/a.png": object() }) } as never;
    const head = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", {
      method: "HEAD",
      headers: { Origin: "https://admin.maara.co.in" },
    }), env);
    expect(head.status).toBe(200);
    expect(head.headers.get("ETag")).toBe('"abc"');
    expect(head.headers.get("Access-Control-Allow-Origin")).toBe("https://admin.maara.co.in");
    expect(await head.text()).toBe("");
  });

  it("supports conditional GET with CORS headers", async () => {
    const env = { PUBLIC_MEDIA: bucketFor({ "assets/public/products/a.png": object() }) } as never;
    const notModified = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", {
      headers: {
        Origin: "https://admin.maara.co.in",
        "If-None-Match": '"abc"',
      },
    }), env);
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get("ETag")).toBe('"abc"');
    expect(notModified.headers.get("Access-Control-Allow-Origin")).toBe("https://admin.maara.co.in");
    expect(await notModified.text()).toBe("");
  });

  it("answers approved-origin preflight without touching R2", async () => {
    const calls = { get: 0, head: 0 };
    const env = { PUBLIC_MEDIA: bucketFor({}, calls) } as never;
    const response = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", {
      method: "OPTIONS",
      headers: {
        Origin: "https://admin.maara.co.in",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "If-None-Match",
      },
    }), env);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://admin.maara.co.in");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("If-None-Match");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("3600");
    expect(calls).toEqual({ get: 0, head: 0 });
  });

  it("does not preflight private paths", async () => {
    const calls = { get: 0, head: 0 };
    const response = await worker.fetch(new Request("https://cdn.example/assets/private/a.png", {
      method: "OPTIONS",
      headers: {
        Origin: "https://admin.maara.co.in",
        "Access-Control-Request-Method": "GET",
      },
    }), { PUBLIC_MEDIA: bucketFor({}, calls) } as never);
    expect(response.status).toBe(404);
    expect(calls).toEqual({ get: 0, head: 0 });
  });

  it.each(["POST", "PUT"]) ("rejects %s", async (method: string) => {
    const response = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", { method }), { PUBLIC_MEDIA: bucketFor({}) } as never);
    expect(response.status).toBe(405);
  });

  it("rejects unapproved origins without accessing R2", async () => {
    const calls = { get: 0, head: 0 };
    const response = await worker.fetch(new Request("https://cdn.example/assets/public/products/a.png", {
      headers: { Origin: "https://evil.example" },
    }), { PUBLIC_MEDIA: bucketFor({ "assets/public/products/a.png": object() }, calls) } as never);
    expect(response.status).toBe(403);
    expect(calls).toEqual({ get: 0, head: 0 });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("returns CORS headers on controlled 404 responses", async () => {
    const response = await worker.fetch(new Request("https://cdn.example/assets/public/products/missing.png", {
      headers: { Origin: "https://admin.maara.co.in" },
    }), { PUBLIC_MEDIA: bucketFor({}) } as never);
    expect(response.status).toBe(404);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://admin.maara.co.in");
  });

  it("returns 404 for private, listing, malformed, and missing paths", async () => {
    const env = { PUBLIC_MEDIA: bucketFor({}) } as never;
    for (const path of ["assets/private/docs/a.pdf", "", "assets/public/products/missing.png", "assets/public/%E0%A4%A.png"]) {
      const response = await worker.fetch(new Request(`https://cdn.example/${path}`), env);
      expect(response.status).toBe(404);
    }
  });
});
