# Deployment — Vercel and Supabase

**Status:** plan only. Nothing has been deployed, no hosted Supabase project has
been created or modified, and no production secrets exist in this repository.
Deployment requires explicit owner approval.

---

## 1. Topology

```text
GitHub repository
   ├── Vercel project  → apps/admin (Next.js 16)
   └── Supabase project → Postgres, Auth, Storage, RLS
```

Both environments are separate: `local` (Supabase CLI + Docker) and
`production` (hosted Supabase + Vercel). There is no shared database between them.

## 2. Vercel configuration

| Setting | Value |
| --- | --- |
| Root directory | repository root |
| Framework preset | Next.js |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter @maara/admin build` |
| Output | `.next` (managed by Next) |
| Node version | 22.x (matches `engines`) |
| Region | closest to the primary customer base (India: `bom1`) |

`pnpm` version is pinned by `packageManager` in the root `package.json`. Vercel
honours it through Corepack; if Corepack is unavailable, set
`PNPM_VERSION=10.18.3` in the project environment.

Environment variables (production and preview separately):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=            # server-only, never NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=
```

Preview deployments use a separate Supabase project or the local/staging project;
they must never point at production data. Auth redirect allow-lists include the
production domain and the Vercel preview wildcard only if preview auth is
required.

## 3. Supabase production setup

1. Create the hosted project in the correct region (Mumbai) with a strong
   database password stored in a password manager.
2. Record the project URL, publishable key and secret key in Vercel.
3. Configure Auth:
   - site URL = production domain;
   - additional redirect URLs = `https://<domain>/auth/callback`,
     `https://<domain>/reset-password`;
   - password minimum 12, letters + digits;
   - disable open signup unless the invitation-only policy is confirmed;
   - email templates for invite and recovery.
4. Create private storage buckets: `product-images`, `category-images`,
   `expense-attachments`, `organization-assets`. Apply the policies from
   `docs/security/rls-policies.md`.
5. Apply migrations **only** after they have passed locally:
   ```powershell
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push --dry-run
   pnpm exec supabase db push
   ```
6. Run `supabase db diff` and the security advisors, and review every finding.
7. Verify RLS is enabled on every exposed table before any real data is entered.

No production data is seeded. The demo seed in `supabase/seed.sql` is empty and
must stay empty for production.

## 4. Release process

1. All checks pass locally: typecheck, lint, unit, integration, build.
2. Migrations reviewed and tested on a staging project.
3. Preview deployment verified (login, one real read, one real write in a
   staging tenant).
4. Production migration applied with a backup/snapshot taken first.
5. Vercel production deployment promoted.
6. Post-deploy smoke: health endpoint, login, overview, one read-only report.
7. Rollback plan:
   - application: promote the previous Vercel deployment;
   - database: forward-fix migration; automatic down-migrations are not assumed
     to exist.

## 5. Backups and retention

- Enable Supabase daily backups (plan-dependent) and verify restore on a
  throwaway project at least quarterly.
- Storage objects are covered by the same retention policy as the database;
  document the chosen retention before onboarding real customers.
- Audit logs are retained for at least 12 months.
- Deletion of an organization requires a documented, owner-approved procedure and
  a grace period; it is not a single click in the UI.

## 6. Observability

| Signal | Tool |
| --- | --- |
| Runtime errors | Vercel logs / error tracking provider (later) |
| Slow queries | Supabase query performance and `pg_stat_statements` |
| Auth anomalies | Supabase Auth logs |
| Failed mutations | Structured server logs with request id, no PII |
| Uptime | External monitor on `/api/health` |

## 7. Security checklist before go-live

- [ ] No secret in a `NEXT_PUBLIC_` variable.
- [ ] `.env.local` and secret files absent from the repository history.
- [ ] RLS enabled and tested on every exposed table.
- [ ] Storage buckets private; signed URLs only.
- [ ] CSP, HSTS and other headers verified in production.
- [ ] Rate limits active on auth and invitation endpoints.
- [ ] Signup policy matches the business decision.
- [ ] Backups and restore procedure verified.
- [ ] Owner approval recorded for the production launch.

## 8. What is intentionally not done yet

- No Vercel project exists.
- No Supabase hosted project exists.
- No domain is configured.
- No CI pipeline is committed; GitHub Actions will be added with the first
  integration tests so it can run them against a disposable Supabase instance.
