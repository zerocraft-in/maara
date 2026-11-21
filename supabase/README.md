# Supabase Local Project

`config.toml` was generated with `supabase init` (CLI 3.1.0) and then adjusted
for this project:

- Auth site URL points at `http://localhost:3000`.
- Password minimum is 12 characters with letters and digits.
- Storage upload limit is 10 MiB.
- Signup stays enabled for local development only.

## Current state

- No migration has been created or applied.
- The local stack has **not** been started because Docker Desktop is not
  installed on this machine.
- `seed.sql` is intentionally empty.

## When Docker is available

```powershell
pnpm exec supabase start
pnpm exec supabase status
pnpm db:reset
```

Then create migrations with the CLI so the timestamps are real:

```powershell
pnpm exec supabase migration new 001_extensions_and_common_functions
```

Do not invent migration filenames or edit an already-applied migration. The
logical migration order is documented in `docs/database/schema.md`.

## Layout

```text
supabase/
├── config.toml      local ports, auth, storage
├── seed.sql         empty until Phase 2
├── migrations/      created by the CLI when the first migration is written
└── tests/           pgTAP/RLS suites (Phase 2)
```

Nothing in this directory is linked to a hosted Supabase project.
