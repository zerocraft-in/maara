# Security Policy

Maara Merch handles business records, financial data and staff identities for
retail organizations. Security is a product requirement, not a later hardening
step.

---

## Supported versions

The project is in pre-release development. There is no production deployment and
no supported public version yet. Security guidance below describes the rules the
implementation must satisfy from Phase 2 onward.

## Reporting a vulnerability

Do **not** open a public issue for a security problem. Report it privately to the
project owner with:

- a description of the issue and the affected area;
- reproduction steps or a proof of concept;
- impact assessment (data exposure, privilege escalation, denial of service);
- suggested remediation, if known.

Do not include production secrets, customer data or exploit payloads in a public
channel. Acknowledgement and a remediation timeline are provided by the owner.

## Secrets

- `SUPABASE_SECRET_KEY` is server-only. It is never prefixed with
  `NEXT_PUBLIC_`, never imported into a client component, and never logged.
- `.env.local` and other secret-bearing files are gitignored.
- Only `.env.example` (names and safe descriptions) is committed.
- Keys are rotated immediately if exposed. A leaked service key is treated as a
  full database compromise.
- Local development keys are not reused in hosted environments.
- No secret is placed in source code, tests, fixtures, screenshots or issue
  reports.

## Authentication

- Supabase Auth with `@supabase/ssr`; sessions are cookie-based and `HttpOnly`.
- Server decisions use `getUser()`, never a client-supplied identity or
  `user_metadata`.
- Proxy/Middleware performs optimistic redirects and session refresh only; it is
  not the authorization boundary.
- Every protected page, Server Action and Route Handler re-verifies the user and
  organization membership.
- Password reset requests never reveal whether an account exists.
- Invitations are hashed at rest, single-use, expiring and bound to an email.

## Authorization and tenancy

- Every business row carries `organization_id`.
- Access is granted only through active `organization_members` rows.
- RLS is enabled on every exposed table. `TO authenticated` alone is never
  considered sufficient.
- Policies enforce both membership and permission, and `UPDATE` policies include
  `WITH CHECK` to prevent moving rows across organizations.
- Client-provided organization ids are ignored for authorization.
- Privilege escalation is blocked server-side: members cannot change their own
  role, assign a role at or above their own rank, or remove the last owner.
- Inventory balances, movements, receipts, orders, payments and ledger rows have
  no client write path.

Until the RLS suite in `docs/security/rls-policies.md` runs against a real
database, tenant isolation is unproven.

## Database

- Migrations are the only schema change mechanism.
- Privileged functions live in the `private` schema, use
  `set search_path = ''`, and restrict `execute` grants.
- Stock movements and ledger rows are append-only.
- Money is integer paise; percentages are basis points.
- No SQL is built by string concatenation from user input.
- Production migrations require local verification, a dry run, a backup and
  explicit owner approval.

## Files and storage

- All buckets are private.
- Object paths are scoped to `org/<organization_id>/...` and enforced by policy.
- Uploads validate MIME type, extension and size server-side.
- Downloads use short-lived signed URLs.
- No business document is publicly accessible.

## Application hardening

- All server inputs are validated with Zod; unknown fields are rejected.
- Errors returned to clients are safe and do not include SQL, stack traces or
  whether a record exists in another tenant.
- Sensible security headers are set (CSP verified, HSTS, nosniff,
  frame-ancestors, referrer policy).
- Auth, invitation and export endpoints are rate-limited.
- Audit logs record security-relevant actions and are not writable by clients.
- Dependencies are pinned; `pnpm audit` is reviewed before releases.

## Deployment

- No hosted Supabase project is created, linked or modified without explicit
  owner approval.
- No deployment to Vercel occurs without approval.
- Production keys are configured in the hosting provider, never in the repository.
- Backups and a restore test are required before real customer data is onboarded.

## Known gaps (current phase)

- No authentication or RLS implementation exists yet.
- No migration has been applied or tested; Docker is unavailable on the current
  development machine.
- No automated security tests have run.
- No penetration test or third-party audit has been performed.

These gaps are tracked in `docs/development/implementation-plan.md` and must be
closed before any production use.
