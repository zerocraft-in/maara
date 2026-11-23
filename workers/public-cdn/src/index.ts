const PUBLIC_PREFIX = "assets/public/";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

type R2Metadata = {
  readonly httpMetadata?: { readonly contentType?: string };
  readonly httpEtag?: string;
  readonly size?: number;
  readonly body: ReadableStream;
};

type PublicBucket = {
  get(key: string): Promise<R2Metadata | null>;
  head(key: string): Promise<Omit<R2Metadata, "body"> | null>;
};

function responseHeaders(object: Omit<R2Metadata, "body">, request: Request): Headers {
  const headers = new Headers({
    "Cache-Control": CACHE_CONTROL,
    "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
  });
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  if (typeof object.size === "number") headers.set("Content-Length", String(object.size));
  const match = request.headers.get("If-None-Match");
  if (match && object.httpEtag && match.split(",").some((value) => value.trim() === object.httpEtag)) {
    headers.set("Content-Length", "0");
  }
  return headers;
}

function keyFromRequest(request: Request): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith("/")) return null;
  const key = pathname.slice(1);
  const segments = key.split("/");
  if (
    !key.startsWith(PUBLIC_PREFIX) ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))
  ) {
    return null;
  }
  return key;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const key = keyFromRequest(request);
    if (!key) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });

    if (request.method === "HEAD") {
      const object = await (env.PUBLIC_MEDIA as unknown as PublicBucket).head(key);
      if (!object) return new Response("Not Found", { status: 404 });
      const headers = responseHeaders(object, request);
      if (headers.get("Content-Length") === "0" && headers.has("ETag")) return new Response(null, { status: 304, headers });
      return new Response(null, { status: 200, headers });
    }

    const object = await (env.PUBLIC_MEDIA as unknown as PublicBucket).get(key);
    if (!object) return new Response("Not Found", { status: 404 });
    const headers = responseHeaders(object, request);
    if (headers.get("Content-Length") === "0" && headers.has("ETag")) return new Response(null, { status: 304, headers });
    return new Response(object.body, { status: 200, headers });
  },
};

export { keyFromRequest, PUBLIC_PREFIX };
