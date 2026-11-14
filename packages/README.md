# Shared packages (reserved)

This directory is reserved for code shared by future Maara clients:

```text
packages/
├── contracts/       API and RPC payload schemas shared with POS / storefront
└── shared-types/    generated database types and cross-app enums
```

Nothing is here yet on purpose. Phase 1 has no second consumer of these types, and
an empty workspace package with no content would be an unused abstraction. The
first package is created when the POS API contract or generated Supabase types
are actually needed, and it will be added to `pnpm-workspace.yaml` (already
globs `packages/*`).
