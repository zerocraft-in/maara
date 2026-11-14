# API Reference

**Current state (Phase 1):** Maara Merch exposes **no application API**. The
Next.js app serves one static status page at `/`, with no Server Actions, Route
Handlers, database reads or writes. Everything below marked *planned* describes
the contracts Phase 2–6 will implement; none of it exists yet.

---

## 1. Principles

- The admin app is a server-rendered Next.js application; most mutations are
  **Server Actions**, not public REST endpoints.
- Anything callable by future clients (POS, van app, storefront) is a narrow,
  versioned **database function** exposed through Supabase RPC or a Route Handler
  with explicit authentication.
- No endpoint trusts a client-supplied `organization_id`. The organization is
  resolved from the session and membership.
- Every input is validated with Zod on the server. Database errors are mapped to
  stable, safe messages.
- Lists are paginated server-side. No endpoint returns an entire table.

## 2. Planned Server Actions

Server Actions live in `src/features/<domain>/actions.ts`, are marked
`"use server"`, and return a discriminated result:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fields?: Record<string, string> } };
```

| Domain | Actions |
| --- | --- |
| Auth | `signIn`, `signOut`, `requestPasswordReset`, `updatePassword` |
| Organization | `createOrganization`, `updateOrganization`, `switchOrganization` |
| Members | `inviteMember`, `revokeInvitation`, `acceptInvitation`, `changeRole`, `deactivateMember` |
| Locations | `createLocation`, `updateLocation`, `archiveLocation` |
| Catalogue | `createCategory`, `updateCategory`, `archiveCategory`, `createBrand`, `updateBrand`, `createProduct`, `updateProduct`, `archiveProduct`, `createVariant`, `updateVariant`, `deleteVariant` |
| Suppliers | `createSupplier`, `updateSupplier`, `archiveSupplier` |
| Customers | `createCustomer`, `updateCustomer`, `archiveCustomer`, `addCustomerNote` |
| Inventory | `adjustStock`, `approveAdjustment`, `createTransfer`, `dispatchTransfer`, `receiveTransfer`, `cancelTransfer` |
| Purchases | `createPurchaseOrder`, `updatePurchaseOrder`, `submitPurchaseOrder`, `cancelPurchaseOrder`, `receivePurchaseOrder`, `createSupplierReturn` |
| Sales | `createSale`, `completeSale`, `voidSale`, `createReturn`, `completeReturn`, `recordPayment` |
| Expenses | `createExpense`, `updateExpense`, `deleteExpense`, `createExpenseCategory` |
| Settings | `updateTaxSettings`, `updateInvoiceSettings`, `updatePreferences` |

The action validates the form, calls the corresponding trusted database function
for anything transactional, revalidates affected paths, and returns the typed
result. The client never receives SQL errors.

## 3. Planned Route Handlers

| Route | Method | Purpose | Auth |
| --- | --- | --- | --- |
| `/auth/callback` | GET | Exchange Supabase auth code for a session | public, PKCE code required |
| `/api/reports/[report]/export` | GET | CSV export of the current report query | session + `reports.export` |
| `/api/health` | GET | Deployment health check (no tenant data) | public |
| `/api/webhooks/payments` | POST | Future payment provider webhook | signature verification, secret only |

Exports stream from the database cursor and apply the same filters as the screen
they were invoked from. No export endpoint accepts raw SQL or an arbitrary table
name.

## 4. Planned database functions (RPC)

These are the stable contracts future clients reuse. All are invoked with the
caller's JWT and enforce permissions internally.

```text
create_organization(p_name text, p_timezone text, p_currency text) returns uuid
invite_member(p_org uuid, p_email text, p_role_key text) returns uuid
accept_invitation(p_token text) returns uuid
receive_purchase_order(p_order uuid, p_lines jsonb, p_received_at timestamptz, p_note text) returns jsonb
adjust_stock(p_location uuid, p_variant uuid, p_delta int, p_reason_code text, p_note text) returns jsonb
transfer_stock(p_from uuid, p_to uuid, p_lines jsonb, p_note text) returns uuid
record_sale(p_location uuid, p_channel text, p_customer uuid, p_lines jsonb,
            p_payments jsonb, p_idempotency_key text) returns jsonb
complete_return(p_return uuid) returns jsonb
record_expense(p_payload jsonb) returns uuid
```

Contract rules:

- Money in/out is integer paise. The server recomputes totals from line inputs
  and ignores client-supplied totals.
- `p_lines` is validated as JSON with an explicit schema; unknown keys are
  rejected.
- Errors use SQLSTATE plus a stable code (`INSUFFICIENT_STOCK`,
  `INVALID_STATUS`, `PERMISSION_DENIED`, `IDEMPOTENT_REPLAY`) and never leak row
  contents.
- Idempotency keys are required for sale completion and honoured for purchase
  receiving.

## 5. Planned read model

Server Components query through `src/features/<domain>/queries.ts`, which uses the
server Supabase client so RLS applies. Query functions accept:

```ts
type ListQuery = {
  page: number;          // 1-based
  pageSize: number;      // capped at 100
  search?: string;
  sort?: { field: string; direction: "asc" | "desc" };
  filters?: Record<string, string | string[]>;
  from?: string;         // ISO date
  to?: string;
  locationId?: string;
};
```

Responses return `{ rows, page, pageSize, total, totalPages }`. Aggregates are
computed in SQL, not in the client.

## 6. Rate limiting and abuse

- Auth endpoints are rate-limited per IP and email.
- Invitations are limited per organization per hour.
- Exports are limited per user; large exports become queued jobs.
- All mutation payload sizes are bounded (line counts, text lengths, upload
  size) before they reach the database.

## 7. Versioning

Database functions are additive. Breaking changes require a new function name
(for example `record_sale_v2`) while the old function remains until all clients
are upgraded. Future Flutter clients pin a schema version in their requests so
the server can reject incompatible payloads early.
