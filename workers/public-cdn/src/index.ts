const PUBLIC_PREFIX = "assets/public/";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const ALLOWED_ORIGIN = "https://admin.maara.co.in";
const ALLOWED_METHODS = "GET, HEAD";
const ALLOWED_HEADERS = "If-None-Match";
const EXPOSED_HEADERS = "ETag";
const CORS_MAX_AGE = "3600";

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

function appendVary(headers: Headers, value: string): void {
  const values = new Set(
    (headers.get("Vary") ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  values.add(value);
  headers.set("Vary", Array.from(values).join(", "));
}

function applyCors(headers: Headers, request: Request): Headers {
  if (request.headers.get("Origin") === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    headers.set("Access-Control-Expose-Headers", EXPOSED_HEADERS);
    appendVary(headers, "Origin");
  }
  return headers;
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return !origin || origin === ALLOWED_ORIGIN;
}

function preflight(request: Request): Response {
  const headers = applyCors(new Headers(), request);
  const requestedMethod = request.headers.get("Access-Control-Request-Method");
  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  if (request.headers.get("Origin") !== ALLOWED_ORIGIN || (requestedMethod && !["GET", "HEAD"].includes(requestedMethod))) {
    return new Response("Forbidden", { status: 403, headers });
  }
  if (requestedHeaders.some((header) => header !== "if-none-match")) {
    return new Response("Forbidden", { status: 403, headers });
  }

  if (!keyFromRequest(request)) {
    return new Response("Not Found", { status: 404, headers });
  }

  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  headers.set("Access-Control-Max-Age", CORS_MAX_AGE);
  return new Response(null, { status: 204, headers });
}

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
  // Reject decoded and still-encoded NUL bytes. The latter covers a
  // double-encoded `%2500` sequence after the single URL decode above.
  if (key.includes("\0") || /%00/i.test(key)) return null;
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
    if (request.method === "OPTIONS") return preflight(request);

    if (!originAllowed(request)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: applyCors(new Headers({ Allow: ALLOWED_METHODS }), request),
      });
    }

    const key = keyFromRequest(request);
    if (!key) {
      return new Response("Not Found", {
        status: 404,
        headers: applyCors(new Headers({ "Cache-Control": "no-store" }), request),
      });
    }

    if (request.method === "HEAD") {
      const object = await (env.PUBLIC_MEDIA as unknown as PublicBucket).head(key);
      if (!object) return new Response("Not Found", { status: 404, headers: applyCors(new Headers(), request) });
      const headers = applyCors(responseHeaders(object, request), request);
      if (headers.get("Content-Length") === "0" && headers.has("ETag")) return new Response(null, { status: 304, headers });
      return new Response(null, { status: 200, headers });
    }

    const object = await (env.PUBLIC_MEDIA as unknown as PublicBucket).get(key);
    if (!object) return new Response("Not Found", { status: 404, headers: applyCors(new Headers(), request) });
    const headers = applyCors(responseHeaders(object, request), request);
    if (headers.get("Content-Length") === "0" && headers.has("ETag")) return new Response(null, { status: 304, headers });
    return new Response(object.body, { status: 200, headers });
  },
};

export { keyFromRequest, PUBLIC_PREFIX };
