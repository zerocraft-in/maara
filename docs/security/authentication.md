# Authentication and Session Management

**Status:** Phase 1 design. Supabase Auth is configured locally but no auth UI or
SSR client exists yet. Phase 2 implements this document against the local stack.

---

## 1. Scope

Phase 2 delivers:

- Email + password login
- Logout
- Forgot password and password reset
- Session persistence through cookies
- Protected dashboard routes
- Server-side user verification on every request
- User profile
- Organization membership and the onboarding flow
- Role-based permissions
- Invitations

Not in scope: social login, passkeys, MFA, SMS. The schema and configuration do
not block them later.

## 2. Supabase keys

| Variable | Visibility | Use |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser | Anonymous/publishable client key |
| `SUPABASE_SECRET_KEY` | **server only** | Trusted admin operations that cannot run under RLS |

The secret key is read only in server modules, is never imported by a client
component, and is never given a `NEXT_PUBLIC_` prefix. Invitations and any
administrative auth calls that require elevated privileges run in Server Actions
or Route Handlers, not in the browser.

Local development uses the values printed by `supabase start`. Hosted values are
provisioned later, after approval.

## 3. Client architecture

```text
src/lib/supabase/client.ts        createBrowserClient (client components)
src/lib/supabase/server.ts        createServerClient with cookies() (server)
src/lib/supabase/admin.ts         service-client, server-only, explicit use
src/lib/auth/session.ts           getSession(), requireUser(), requireOrganization()
src/lib/auth/redirects.ts         safe redirect validation
src/proxy.ts                      session refresh + optimistic route protection
```

Rules:

- `createBrowserClient` is created once per browser context.
- `createServerClient` is created per request and uses `cookies()` from
  `next/headers`; never a module-level singleton.
- `getUser()` — not `getSession()` — is the authority for server decisions.
  `getSession()` is only used for optimistic UI.
- The admin client (`SUPABASE_SECRET_KEY`) is used for invitation delivery and
  other operations that genuinely need it, after the caller's membership and
  permission have already been verified with the user client.
- Server code resolves the active organization from
  `organization_members`, using the cookie only as a preference hint.

### Next.js 16 note

Next.js 16 renamed Middleware to **Proxy**. The session-refresh file is
`src/proxy.ts` exporting `proxy(request)`; the file location is at the same level
as `app`. Proxy performs an optimistic redirect for unauthenticated dashboard
requests and refreshes cookies via `@supabase/ssr`. It is **not** the
authorization boundary: every page, layout, Server Action and Route Handler calls
`requireUser()`/`requireOrganization()` independently.

## 4. Flows

### Login

1. User submits email + password to a Server Action.
2. Zod validates shape and normalises the email.
3. `signInWithPassword` runs on the server client.
4. On success, cookies are written by the server client and the action redirects
   to the validated `next` path (default `/overview`).
5. On failure, a generic message is returned ("Email or password is incorrect")
   with a stable form error; no distinction between unknown account and bad
   password.
6. Rate limiting is applied per IP + email in front of repeated attempts.

### Logout

Server Action calls `signOut()`, clears the Supabase cookies, and redirects to
`/login`. Client-side state is discarded; no protected data remains cached.

### Forgot password

1. User submits email.
2. Always returns the same confirmation message, whether or not the account
   exists (no account enumeration).
3. `resetPasswordForEmail` sends a link to `/auth/callback?next=/reset-password`.
4. The callback exchanges the code for a session, then redirects to
   `/reset-password`.
5. The reset form calls `updateUser({ password })` with server-side validation
   (minimum 12 characters, letters and digits). On success the user is signed in
   with a fresh session.

### Session refresh

Proxy runs on dashboard and auth routes, refreshes expired tokens, and passes
updated cookies to the response. If refresh fails, cookies are cleared and the
user is redirected to `/login?next=<path>`.

### Protected routes

| Route group | Requirement |
| --- | --- |
| `(dashboard)/*` | authenticated user + active organization membership |
| `/onboarding` | authenticated user with no membership |
| `(auth)/*` | unauthenticated; authenticated users are redirected to `/overview` |
| `/auth/callback` | valid PKCE code or token hash |

## 5. Organizations and onboarding

A new customer does not self-create an arbitrary organization through a public
endpoint. The flow is:

1. The user is created by invitation, or signs up while signup is enabled.
2. `/onboarding` shows "Create your business" for users with no membership.
3. The form calls `private.create_organization(name, timezone, currency)`.
4. The RPC, in one transaction, creates:
   - the organization
   - two default locations (`Main Shop`, `Main Warehouse`)
   - default settings row
   - the Owner membership for the caller
   - the audit entry
5. The RPC is rate-limited and rejects a second organization created by
   automated retries within a short window.

Signups are disabled in production unless a deliberate invitation-only policy is
in place. The local config keeps `enable_signup = true` for development.

### Invitations

- Only `users.manage` can invite.
- The invitee email, role and organization are validated; the inviter cannot
  assign a role at or above their own rank.
- A random token is generated, stored **hashed** with an expiry (72 hours), and
  sent by email.
- Acceptance requires the signed-in user's verified email to match the
  invitation email.
- The token is single-use; acceptance creates or activates the membership inside
  a transaction.
- Revoking an invitation deletes the hash and invalidates the link.

## 6. Authorization helpers

```ts
type SessionContext = {
  user: User;
  memberships: MembershipSummary[];
  activeOrganization: OrganizationSummary | null;
  permissions: Set<PermissionKey>;
};

requireUser(): Promise<User>
requireOrganization(): Promise<SessionContext>   // active org resolved from membership
requirePermission(key: PermissionKey): Promise<SessionContext>
```

- `requireOrganization` reads memberships from the database on every request; it
  does not trust a JWT claim or cookie for authorization.
- Permission checks in application code use the same `roles`/`permissions`
  tables that RLS uses, so the two cannot drift.
- Server Actions return a typed `ActionResult` union rather than throwing raw
  database errors.

## 7. Cookie and session policy

- Cookies are `HttpOnly`, `Secure` in production, `SameSite=Lax`.
- No auth token is written to `localStorage`.
- The Supabase session cookie is refreshed by proxy; long-lived pages revalidate
  through server calls.
- `next` redirect parameters are validated to be same-origin relative paths to
  prevent open redirects.
- Auth errors never include SQL, stack traces or whether an email exists.

## 8. Security headers

Configured in `next.config.ts` (Phase 2):

```text
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob: <supabase-storage>;
  connect-src 'self' <supabase-url>; style-src 'self' 'unsafe-inline'; script-src 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

CSP needs a nonce or hash strategy for Next.js inline bootstrap scripts; this is
implemented and verified in Phase 2, not guessed here.

## 9. Test plan

| Test | Type |
| --- | --- |
| Unauthenticated `/overview` redirects to `/login` | E2E |
| Login with valid and invalid credentials | E2E + integration |
| Password reset request does not reveal account existence | integration |
| Expired invitation rejected | integration |
| Cross-organization membership lookup returns nothing | RLS test |
| Member cannot self-promote | RLS/RPC test |
| Server Action rejects missing permission | integration |
| Sign-out clears session and back button does not restore data | E2E |
