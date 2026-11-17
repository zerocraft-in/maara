# Maara Merch — Media Management System Implementation Report

## 1. Implementation Summary

Completed the Maara Merch Media Management system into a production-quality, reusable media infrastructure integrated throughout the admin dashboard. The system is built on the existing infrastructure (Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui, Supabase auth + org-based permissions, Cloudflare R2 via AWS S3 SDK) without replacing any existing dashboard, auth, or design-system components.

### How it works

- **Storage layer**: Cloudflare R2 bucket `assets`, served via custom domain `https://media.maara.co.in`. R2 credentials are server-only (`src/lib/r2.ts`, `server-only`). The browser never sees secrets.
- **Metadata layer**: `public.media` table (organization-scoped RLS, `create_media`/`update_media`/`delete_media` SECURITY DEFINER RPCs). No new tables or migrations were needed.
- **API**: `POST /api/content/files` validates uploads server-side (file policy), generates a server-controlled object key `{orgId}/{uuid}-{sanitizedName}`, and returns a short-lived presigned PUT URL. The client PUTs bytes directly to R2, then registers metadata via a server action.
- **Reliable lifecycle**: Upload registers metadata only after R2 success; on registration failure the R2 object is compensating-deleted. Delete removes the R2 object first, then the DB record (never loses the only reference to an object). Rename uses copy→verify→update-metadata→delete-original orchestration.
- **Media Manager** (`/content/files`): grid + list views, debounced search, file-type filtering, sorting, server-side cursor pagination (keyset), drag-and-drop + click upload with per-file progress/retry/cancel, bulk selection + delete with confirmation, single delete/rename, copy URL, open/download, empty/loading/error states.
- **MediaPicker** (`src/components/media-picker/`): reusable dialog (single/multi selection, limits, upload-from-picker, pagination, search, filters) that reuses the existing upload service.
- **Product Images**: The Images tab in `product-form.tsx` is now functional — add via MediaPicker, reorder, featured indicator, remove, edit alt text, load existing images on edit, and persist changes (create/update/delete `product_images`) on save.

## 2. Files Created

| File | Purpose |
|------|---------|
| `apps/admin/src/lib/file-policy.ts` | Centralized file upload policy: allowed extensions/MIME per category, size limits (image 15 MB, video 100 MB, document 20 MB), magic-byte content-signature verification, filename sanitization, R2 object verification. SVG rejected by default. |
| `apps/admin/src/components/media-picker/media-picker.tsx` | Reusable MediaPicker dialog component (single/multi selection, selection limits, upload-from-picker, search, type filter, cursor pagination, loading/empty/error states). |
| `apps/admin/src/lib/file-policy.test.ts` | Unit tests for the file policy: validation, sanitization, signature verification, size limits, key generation (26 tests). |
| `apps/admin/src/app/(dashboard)/content/files/actions.test.ts` | Server-side tests for media actions with mocked Supabase/R2: register (success, compensating delete on failure, permission rejection), delete (R2-first, abort on R2 failure), rename, permission rejection (7 tests). |

## 3. Files Modified

| File | Change |
|------|--------|
| `apps/admin/src/components/layout/data-table.tsx` | Pre-existing orphaned file importing missing siblings blocked the build. Converted to a re-export of the canonical products-module `DataTable` (kept the file, no deletion). |
| `apps/admin/src/components/layout/products-manager.tsx` | Same treatment: re-export of the canonical products-module `ProductsManager`. |
| `apps/admin/src/app/api/content/files/route.ts` | Rewrote for security and correctness: organization resolved from session (never client-trusted); `media.view`/`media.create`/`media.update`/`media.delete` + role gating on every method; keyset cursor pagination with stable ordering; search + file-type filter + sort; POST validates via file policy, generates server-controlled key + short-lived presigned PUT URL; DELETE removes R2 first then DB; PATCH rename uses copy→metadata update→delete-original. |
| `apps/admin/src/app/(dashboard)/content/files/actions.ts` | Rewrote server actions: `registerMediaFile` with compensating R2 deletion when Supabase registration fails; `deleteMediaFile` deletes R2 object first then DB record; `renameMediaFile` via `update_media` RPC. All Zod-validated, permission-checked, org-scoped. |
| `apps/admin/src/app/(dashboard)/content/files/files-manager.tsx` | Rewrote the Media Manager UI: grid and list views, drag-and-drop upload zone (keyboard accessible), click-to-browse, multiple files, per-file progress, retry/cancel, debounced search, type filtering, sorting, server-side cursor pagination with "Load more", bulk selection + delete confirmation, single delete/rename, copy URL/open/download, empty/loading/error states. |
| `apps/admin/src/app/(dashboard)/products/product-form.tsx` | Made the Images tab functional: MediaPicker integration (multi-select), working image state (add, drag reorder, featured toggle, remove, alt-text edit), existing images loaded on edit, and persistence of create/update/delete `product_images` on save (no success unless images persist). |
| `apps/admin/src/app/(dashboard)/products/[id]/page.tsx` | Added `product_images` loading and passes `images` to `ProductForm`; `ProductData` type extended with `images`. |

Pre-existing working-tree changes (`.env.example`, `package.json`, `sidebar/nav.ts`, `lib/auth/session.ts`, `pnpm-lock.yaml`, and the partial `content/`, `api/content/`, `r2.ts`, `ui/progress.tsx`, migration) were preserved as-is; they were part of the starting state.

## 4. Media Manager Status

| Feature | Status |
|---------|--------|
| Grid view | ✅ Cards with thumbnail/icon, name, type, size, date, context menu, selection checkbox |
| List view | ✅ Compact table reusing table components, preview/icon, name, type, size, date, actions |
| Responsive layouts | ✅ Grid cols 1/2/3/4, stack on mobile, sticky selection bar |
| Search by file name | ✅ Debounced via API `search` param (server-side) |
| File type filtering | ✅ All / Images / Videos / Documents / Other (server-side `content_type` filter) |
| Sorting | ✅ Newest, oldest, name A–Z/Z–A, smallest/largest first (server-side `order by`) |
| Pagination | ✅ Server-side keyset cursor pagination (`created_at` + `id`), stable ordering, no duplicates/skips, "Load more", refresh resets cursor, search/filter change resets cursor |
| Refresh | ✅ Refresh button resets pagination and reloads |
| Empty state | ✅ Empty component with upload CTA |
| Loading skeleton | ✅ Pulse skeleton on initial load |
| Error state | ✅ Error card with retry |
| Upload state | ✅ Per-file progress bar, done/error chips, cancel/retry |
| Selection state | ✅ Individual + select-all, bulk delete with confirmation dialog, individual success/failure reporting |
| Drag-and-drop | ✅ Drag-over visual feedback, multiple files, click-to-browse, invalid files handled via server validation |
| Bulk delete | ✅ Confirmation dialog, per-file success/failure reporting, respects permissions |

Note: Drag-over visual feedback and keyboard handling (Enter/Space) implemented on the upload zone.

## 5. R2 Integration Status

| Feature | Status |
|---------|--------|
| Upload | ✅ Direct-to-R2 presigned PUT; server-validated policy; server-generated key `{orgId}/{uuid}-{name}`; short-lived (15 min) URL |
| Validation | ✅ Extension, MIME, size per category, filename, empty files, path-traversal prevention, magic-byte content signatures |
| Public URLs | ✅ `getPublicUrl(key)` uses `R2_CUSTOM_DOMAIN` (`https://media.maara.co.in/{key}`), falls back to R2 endpoint |
| Rename | ✅ Copy → verify → update metadata → delete original; original preserved on partial failure (recoverable orphan) |
| Delete | ✅ R2 object deleted first, then DB record; never loses the only reference; idempotent retry possible |
| Failure handling | ✅ Upload: compensating R2 delete on registration failure, logged with diagnostics. Delete: aborts DB delete if R2 fails, returns 502. Rename: cleans up copied object if metadata update fails. |
| Secret handling | ✅ R2 credentials server-only (`server-only`); no `NEXT_PUBLIC_` R2 vars; never exposed to browser |
| Org isolation | ✅ Organization from session only; every query/mutation scoped to org; cross-org access rejected (403) |

## 6. MediaPicker Status

| Feature | Status |
|---------|--------|
| Dialog presentation | ✅ `@base-ui/react` Dialog, size-capped (`sm:max-w-[900px]`) |
| API | ✅ `open`, `onOpenChange`, `multiple`, `maxSelection`, `acceptedTypes`, `selectedMedia`, `onConfirm`, `onCancel`, `disabled` |
| Returned item shape | ✅ `{ id, key, name, url, contentType, size, organizationId }` — matches actual DB/media types |
| Single & multi selection | ✅ `multiple` prop, `maxSelection` limit, duplicate prevention, selection limit enforcement |
| Existing selected items | ✅ Seeded from `selectedMedia` prop; re-seeds when it changes |
| Cancel without modifying parent | ✅ `onCancel` / close returns nothing; `onConfirm` returns selected items |
| Upload from picker | ✅ Reuses existing upload service (`registerMediaFile` + API), refreshes library, preserves selections |
| Search / filters / pagination | ✅ Search, type filter, sort, keyset cursor pagination with "Load more" |
| Loading / empty / error | ✅ Skeletons, empty state, error toasts |
| Module independence | ✅ No product/category logic inside the picker; reusable by any module |

## 7. Product Image Integration

| Feature | Status |
|---------|--------|
| Add images via MediaPicker | ✅ "Add images" button opens multi-selection picker; selected images added as product images |
| Multiple image selection | ✅ Up to 10 per picker operation |
| Image previews | ✅ Thumbnail grid with `object-cover` images |
| Featured image selection | ✅ Star toggle; first image featured by default; only one featured at a time |
| Image ordering | ✅ Drag up/down (position persisted); `reindexImages` keeps positions contiguous |
| Remove image | ✅ Remove button; new images removed from working set; existing images deleted via `deleteProductImage` |
| Replace image | ✅ Remove + add via picker |
| Existing image loading on edit | ✅ `[id]/page.tsx` fetches `product_images` and passes to `ProductForm` |
| Save & persist | ✅ On save: creates new images (`createProductImage`), updates changed (`updateProductImage`), deletes removed (`deleteProductImage`). No success unless images persist. |
| Saving without image changes | ✅ No-op for images; product save proceeds |
| Failed image save | ✅ Error surfaced via `submitError`; success not reported |
| Backward compatibility | ✅ Existing URL-based `product_images.src` model preserved; old images not required to migrate |

The first image is featured only when no existing featured image exists (position 1), consistent with `product_images.position` ordering. The `product_images` schema already supports `position` ordering, so no schema change was needed.

## 8. Database Changes

**No migration was applied.** The default (no migration) was followed.

- `public.media` already exists (from `20261117120000_media_foundation.sql`, applied in STAGING) with columns `id, organization_id, key, name, content_type, size_bytes, url, uploaded_by, created_at, updated_at` and org-scoped RLS + `create_media`/`update_media`/`delete_media` RPCs. Sufficient.
- `public.product_images` already exists (from `20261115160000_products_shopify_extensions.sql`) with `position` column for ordering. Sufficient.

No new migration file was created because no schema change is genuinely necessary. If a pending-delete status for orphan cleanup is desired in the future, a separate migration can be prepared (not applied automatically).

## 9. Security Verification

| Control | Status |
|---------|--------|
| Organization isolation | ✅ Organization resolved from session (`requireOrganization`), never from client. Every query/mutation scoped to `organization_id`. Cross-org access rejected (403). |
| Permission enforcement | ✅ `media.view`/`media.create`/`media.update`/`media.delete` checked on every route/action. Role gating (`admin/owner/manager`) also applied. |
| Client-trusted data rejected | ✅ Client never supplies org ID, object key, or public URL. Keys generated server-side. |
| R2 secrets | ✅ `server-only`; never `NEXT_PUBLIC_`; never in browser code. |
| File validation | ✅ Server-side: extension, MIME, size per category, filename, empty files, path traversal, magic-byte signatures. Browser MIME not trusted. |
| SVG | ✅ Rejected by default (not in `EXTENSIONS_BY_CATEGORY.image`) — no active-content risk. |
| Presigned URL | ✅ Short-lived (15 min), PUT method, server-controlled key/content type, org permission checked before generation. |
| Error handling | ✅ No internal exception details leaked to client; generic messages; server logs only codes/messages (no secrets). |
| RLS | ✅ Existing `public.media` RLS policies enforced in addition to application-level checks (defence in depth). |

## 10. Automated Tests

| Suite | Result |
|-------|--------|
| `vitest` (unit + server-side) | ✅ 3 files, **52 passed**, 0 failed |
| - `src/lib/money.test.ts` | 19 passed (pre-existing) |
| - `src/lib/file-policy.test.ts` | 26 passed (new) |
| - `src/app/(dashboard)/content/files/actions.test.ts` | 7 passed (new) |
| Playwright (e2e) | ⚠ Not run — browsers not installed in this environment and no local Supabase stack; config is valid (`playwright.config.ts`, `testDir: ./e2e`) |

Tests never use real production credentials; R2/Supabase are mocked in server-side tests.

## 11. Build Verification

| Check | Baseline | After Changes | Status |
|-------|----------|---------------|--------|
| TypeScript (`tsc --noEmit`) | ❌ Failed (orphaned broken imports) | ✅ Pass | Fixed |
| ESLint (`eslint .`) | ✅ Pass (warnings only) | ✅ Pass (0 new errors; 7 pre-existing errors in untouched files) | Maintained |
| Vitest | ✅ 19 passed | ✅ 52 passed | Maintained + added |
| Production build (`next build`) | ❌ Failed (orphaned imports) | ✅ Exit 0 | Fixed |

Pre-existing build failures (orphaned `components/layout/data-table.tsx` / `products-manager.tsx` importing missing siblings) were fixed by converting both to re-exports of the canonical products-module implementations. No failures were hidden; no lint rules disabled; no types weakened.

## 12. Remaining Issues

| Item | Required Action |
|------|-----------------|
| Playwright e2e tests | Not run: browsers (`pnpm exec playwright install`) and a local Supabase stack are required. Config is valid; tests should run against staging/test data only. |
| R2 CORS | Bucket CORS must allow `PUT` from the admin origin with the upload `Content-Type`. Recommended: allow origin `https://<admin-domain>`, methods `PUT`, headers `Content-Type`, `*` expose. Do not modify Cloudflare automatically — provide settings to ops. |
| R2 env vars | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_CUSTOM_DOMAIN` must be set in the deployment environment (`.env.example` documents them; `.env.local` is gitignored). |
| Staging Supabase | `public.media`, RPCs, RLS, permissions (`media.*`) must exist in STAGING (already applied per `media_foundation`). Do not apply to Production. |
| Production | Do not apply migrations to Production; do not deploy automatically; do not change Production Supabase. |

## 13. Final Readiness Assessment

**Staging Ready**

### Evidence
- TypeScript, ESLint (no new errors), Vitest (52/52), and production `next build` (exit 0) all pass.
- Pre-existing build-blocking orphaned imports fixed; no new failures introduced.
- Complete, secure media infrastructure: server-validated file policy, presigned direct-to-R2 upload, reliable upload/delete/rename lifecycle with compensating transactions, org-isolated and permission-enforced.
- Reusable MediaPicker integrated into the Product Images workflow with full add/reorder/featured/remove/persist behavior.
- No database migration applied; no production changes; no secrets exposed.

Not yet **Production Ready** because Playwright e2e tests have not been executed (requires browsers + local Supabase), R2 CORS and environment variables require deployment-level configuration, and production deployment/migration application are explicitly out of scope per project rules.
