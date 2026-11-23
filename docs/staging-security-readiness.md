# Maara Merch staging security procedure

## Cloudflare R2 configuration

The `maara` bucket must remain private. Do not enable “Public access” or rely
on the R2 custom domain for object reads. The application now returns:

- presigned PUT URLs valid for 15 minutes;
- presigned GET URLs valid for 5 minutes;
- object keys generated only by the server under `assets/{folder}/`;
- metadata and ownership checked through the authenticated organization before
  a signed GET URL is issued.

Required Cloudflare dashboard configuration:

1. R2 → `maara` → Settings → disable public bucket access.
2. Keep the bucket-scoped API token limited to Object Read/Write on `maara`.
3. Add CORS for the staging origin only, allowing `PUT`, `GET`, `HEAD`, and
   `OPTIONS`, with `Content-Type` and `ETag` headers.
4. Do not expose the R2 S3 endpoint or API token to browser code.
5. Existing `media.url` values are treated as metadata only; runtime listing
   returns signed URLs generated from the stored key.

Verification checklist using staging-only object `assets/staging-verification/...`:

- `PUT` with the returned signed URL and the exact signed `Content-Type` → `2xx`.
- `GET` with the returned signed URL before expiry → `2xx`.
- `GET` without a signature → `403` or `404`.
- `GET` after expiry → `403`.
- A signed URL for organization A's `media.id` must never be issued to an
  authenticated organization B user; the API should return `404`/`403`.
- Confirm no response, database row, or browser code uses a permanent custom
  domain URL for runtime access.

## Redis free-tier setup

Use a free Upstash Redis database for hosted staging. Copy its REST URL and
REST token into the staging secret store as `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`. Never commit either value or place them in a
`NEXT_PUBLIC_*` variable. The proxy uses `INCR` plus `EXPIRE` and falls back to
local memory only for development or temporary store outages.

Before staging signoff, verify a 429 response from two application instances
using the same route/IP key. If Redis is unavailable in hosted staging, mark
the rate-limit control BLOCKED rather than treating the local fallback as a
distributed guarantee.

Verification checklist:

- Confirm both secrets exist only in the staging server-side secret store.
- Send the configured number of requests to one rate-limited route through
  instance A and instance B; the shared counter must produce `429` at the same
  threshold.
- Confirm `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
  `X-RateLimit-Reset` are present.
- Temporarily make the Redis endpoint unavailable in a disposable environment;
  development should use the documented local fallback, while hosted staging
  should be marked BLOCKED until distributed protection is restored.

## Isolated RLS test procedure

Create two test users and two organizations in a disposable local Supabase
project or dedicated staging clone. Add each user only to its own org, then
run `supabase/tests/tranche-25_rls.sql` with `ON_ERROR_STOP=1`. Execute the
full mutation matrix for products, customers, orders, purchases, and
inventory, and verify signed R2 URLs cannot be issued for a foreign `media.id`.

No production or shared staging database should be used for fixture creation.
