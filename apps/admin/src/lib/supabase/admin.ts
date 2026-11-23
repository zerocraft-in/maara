/**
 * Server-only Supabase admin client.
 *
 * Uses the service-role secret key (`SUPABASE_SECRET_KEY`). This client
 * bypasses RLS and must only be used in trusted server code after the
 * caller's membership and permission have already been verified with the
 * user-level client.
 *
 * Never imported by a client component. Never given a `NEXT_PUBLIC_`
 * prefix. Never logged or exposed to the browser.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not configured");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY
  );
}
