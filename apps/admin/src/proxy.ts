/**
 * Next.js Proxy (middleware) for session refresh, optimistic route protection,
 * and rate limiting.
 *
 * Runs on dashboard and auth routes. Refreshes expired Supabase Auth cookies
 * and passes them to the response. Performs optimistic redirects for
 * unauthenticated dashboard requests and authenticated auth-route requests.
 *
 * Rate limiting is applied to API routes to protect against abuse.
 *
 * This is NOT the authorization boundary: every page, layout, Server Action
 * and Route Handler independently calls requireUser()/requireOrganization().
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/onboarding",
  "/signup",
];

// ---------------------------------------------------------------------------
// Rate limiting (token-bucket, in-memory store)
//
// In production (multi-instance), swap the store for Redis (e.g. Upstash).
// The interface (increment + remaining + reset) maps directly to Redis.
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  max: number;
  window: number; // seconds
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, RateLimitEntry>();

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/auth/login": { max: 5, window: 300 },
  "/api/auth/invite": { max: 10, window: 3600 },
  "/api/auth/accept-invite": { max: 5, window: 300 },
  "/api/customers": { max: 30, window: 3600 },
  "/api/products": { max: 30, window: 3600 },
  "/api/media": { max: 20, window: 3600 },
  "/api/content/files": { max: 20, window: 3600 },
  "/api/search": { max: 20, window: 60 },
};

function rateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = stores.get(key);

  if (!entry || now > entry.resetAt) {
    stores.set(key, { count: 1, resetAt: now + config.window * 1000 });
    return {
      allowed: true,
      remaining: config.max - 1,
      resetAt: now + config.window * 1000,
    };
  }

  entry.count++;
  const remaining = Math.max(0, config.max - entry.count);
  return {
    allowed: entry.count <= config.max,
    remaining,
    resetAt: entry.resetAt,
  };
}

let lastCleanup = 0;
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, entry] of stores.entries()) {
    if (now > entry.resetAt) stores.delete(key);
  }
}

function findRateLimit(pathname: string): RateLimitConfig | null {
  if (RATE_LIMITS[pathname]) return RATE_LIMITS[pathname];
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(pattern)) return config;
  }
  return null;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const reqPathname = request.nextUrl.pathname;

  // Rate limiting for API routes.
  if (reqPathname.startsWith("/api/")) {
    const config = findRateLimit(reqPathname);
    if (config) {
      maybeCleanup();

      const orgHeader = request.headers.get("x-organization-id");
      const ip = getClientIp(request);
      const rateKey = `ratelimit:${orgHeader ?? ip}:${reqPathname}`;

      const result = rateLimit(rateKey, config);

      if (!result.allowed) {
        return NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(
                Math.ceil((result.resetAt - Date.now()) / 1000)
              ),
              "X-RateLimit-Limit": String(config.max),
              "X-RateLimit-Remaining": String(result.remaining),
              "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
            },
          }
        );
      }
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Refresh session if expired. Required for Auth to work across routes.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isDashboardRoute = !isAuthRoute && pathname !== "/icon.svg";

  // No session: redirect dashboard requests to login.
  if (!user && isDashboardRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Has session: redirect auth-route requests to overview.
  if (user && isAuthRoute) {
    // Onboarding is different: a signed-up user with no active organization
    // membership must stay on /onboarding so they can create their
    // organization. Only redirect away once a membership actually exists.
    if (pathname === "/onboarding") {
      const { data: memberships } = await supabase
        .from("organization_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);

      if (memberships && memberships.length > 0) {
        return NextResponse.redirect(new URL("/overview", request.url));
      }

      return response;
    }

    // Preserve the invitation token when redirecting from /accept-invite so
    // an already-authenticated user can still accept the invitation after
    // authentication is established. The token is never logged.
    if (pathname === "/accept-invite") {
      // Let authenticated users stay on /accept-invite so they can accept
      // the invitation. Do not redirect away to /overview.
      return response;
    }

    return NextResponse.redirect(new URL("/overview", request.url));
  }

  return response;
}
