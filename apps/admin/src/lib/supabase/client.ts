/**
 * Browser Supabase client.
 *
 * Created once per browser context. Used only in client components and
 * event handlers that need to read or write Supabase data from the browser.
 * Never imports or uses the service-role secret key.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
