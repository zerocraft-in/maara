/**
 * Server Supabase client.
 *
 * Created per request using cookies from `next/headers`. Used in Server
 * Components and Server Actions. Never a module-level singleton.
 *
 * Cookie `set`/`remove` are best-effort: they succeed in Server Actions and
 * Route Handlers where a response is available, and are silently ignored in
 * read-only Server Components.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // The `set` method was called from a read-only Server Component.
            // Cookie updates are only possible in Server Actions and Route
            // Handlers where a Response is available.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, "", options);
          } catch {
            // The `remove` method was called from a read-only Server Component.
          }
        },
      },
    }
  );
}
