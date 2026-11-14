/**
 * Next.js Proxy (middleware) for session refresh and optimistic route protection.
 *
 * Runs on dashboard and auth routes. Refreshes expired Supabase Auth cookies
 * and passes them to the response. Performs optimistic redirects for
 * unauthenticated dashboard requests and authenticated auth-route requests.
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
];

export const config = {
  matcher: [
    "/",
    "/overview",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/accept-invite",
    "/onboarding",
  ],
};

export async function middleware(request: NextRequest) {
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
  const isDashboardRoute = pathname === "/overview" || pathname === "/";

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
