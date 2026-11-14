# Row Level Security and Authorization

**Status:** Phase 1 design. RLS is not yet enabled because no schema exists
locally. Phase 2 implements everything in this document and proves it with the
security tests listed at the end.

Authorization has three independent layers. A request must pass all of them:

1. **Session** — `@supabase/ssr` validates the JWT and refreshes cookies.
2. **Server code** — `requireUser()` / `requireOrganization()` re-read
   membership from the database; never from a cookie, header or user metadata.
3. **RLS** — every exposed table filters by verified organization membership and
   permission, so a compromised or bypassed client still cannot cross tenants.

The frontend may hide actions, but hiding is a UX nicety, never a control.

---

## 1. Role catalogue

| Role key | Typical use |
| --- | --- |
| `owner` | Full control, billing, organization deletion, ownership transfer |
| `admin` | Manage settings, users (below owner), catalogue, operations |
| `manager` | Day-to-day operations, approvals, reports |
| `inventory_staff` | Stock adjustments, transfers, goods receiving |
| `accountant` | Expenses, payments, finance reports; read-only catalogue |
| `sales_staff` | Record sales, view customers and stock, no purchasing |

`roles.rank` orders them (`owner` highest) and is used by the API to reject
privilege escalation: a member may only manage members whose rank is strictly
lower than their own, and may never assign a role at or above their own rank
(except owners, who may assign admin but not create a second owner through the
members API).

## 2. Permission keys

| Group | Keys |
| --- | --- |
| Catalogue | `products.read`, `products.write`, `products.archive`, `categories.write`, `brands.write` |
| Inventory | `inventory.read`, `inventory.adjust`, `inventory.transfer`, `inventory.approve` |
| Purchasing | `purchases.read`, `purchases.write`, `purchases.receive`, `purchases.cancel` |
| Sales | `sales.read`, `sales.write`, `sales.refund`, `sales.void` |
| Parties | `suppliers.read`, `suppliers.write`, `customers.read`, `customers.write` |
| Finance | `expenses.read`, `expenses.write`, `finance.read`, `reports.export` |
| Administration | `users.read`, `users.manage`, `settings.read`, `settings.manage`, `audit.read` |

Default grants:

| Permission | owner | admin | manager | inv. staff | accountant | sales staff |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `products.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `products.write` | ✓ | ✓ | ✓ | — | — | — |
| `inventory.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `inventory.adjust` | ✓ | ✓ | ✓ | ✓ | — | — |
| `inventory.transfer` | ✓ | ✓ | ✓ | ✓ | — | — |
| `inventory.approve` | ✓ | ✓ | ✓ | — | — | — |
| `purchases.read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `purchases.write` | ✓ | ✓ | ✓ | — | — | — |
| `purchases.receive` | ✓ | ✓ | ✓ | ✓ | — | — |
| `sales.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sales.write` | ✓ | ✓ | ✓ | — | — | ✓ |
| `sales.refund` | ✓ | ✓ | ✓ | — | ✓ | — |
| `customers.write` | ✓ | ✓ | ✓ | — | — | ✓ |
| `expenses.write` | ✓ | ✓ | ✓ | — | ✓ | — |
| `finance.read` | ✓ | ✓ | ✓ | — | ✓ | — |
| `reports.export` | ✓ | ✓ | ✓ | — | ✓ | — |
| `users.manage` | ✓ | ✓ | — | — | — | — |
| `settings.manage` | ✓ | ✓ | — | — | — | — |
| `audit.read` | ✓ | ✓ | — | — | — | — |

`owner` bypasses the matrix only through an explicit `is_owner(org)` check in
RPCs; policies still require membership.

## 3. Helper functions

All helpers live in the `private` schema, are `security definer`, use
`set search_path = ''`, are owned by `postgres`, and have `execute` revoked from
`public`/`anon` and granted only to `authenticated` (or `service_role`).

```sql
-- Organizations the caller is an active member of.
private.current_org_ids() returns setof uuid

-- Organizations where the caller holds a given permission.
private.authorized_org_ids(permission text) returns setof uuid

-- Boolean form for RPC bodies.
private.has_permission(org uuid, permission text) returns boolean

-- Membership without permission (for profile and organization reads).
private.is_member(org uuid) returns boolean
```

`auth.uid()` is the only identity source. `user_metadata` and client-supplied
organization ids are never consulted. The database resolves the active
organization from the caller's membership, not from a cookie value.

### Policy shape

```sql
alter table public.products enable row level security;

create policy "products_select"
on public.products for select
to authenticated
using (
  organization_id in (select private.authorized_org_ids('products.read'))
);

create policy "products_insert"
on public.products for insert
to authenticated
with check (
  organization_id in (select private.authorized_org_ids('products.write'))
  and created_by = auth.uid()
);

create policy "products_update"
on public.products for update
to authenticated
using (
  organization_id in (select private.authorized_org_ids('products.write'))
)
with check (
  organization_id in (select private.authorized_org_ids('products.write'))
);
```

Rules that apply to every policy set:

- `TO authenticated` is necessary but **never sufficient**.
- Every `UPDATE` policy has both `USING` and `WITH CHECK`.
- `WITH CHECK` repeats the tenant predicate, preventing a row from being moved
  to another organization.
- `DELETE` is granted only where the business model allows it (drafts, empty
  categories, notifications). Historical rows are never deletable.
- No policy uses `user_metadata`, `current_setting('request.jwt.claim...')` or
  an unverified header.

## 4. Table policy matrix

| Table | Select | Insert | Update | Delete |
| --- | --- | --- | --- | --- |
| `organizations` | member | onboarding RPC only | `settings.manage` | owner RPC only |
| `stores`, `locations` | member | `settings.manage` | `settings.manage` | `settings.manage` if no stock/documents |
| `profiles` | own row + members of shared orgs (limited columns via view) | trigger only | own row | never (auth cascade) |
| `organization_members` | `users.read` | `users.manage` via RPC | `users.manage` via RPC | RPC only, never last owner |
| `roles`, `permissions`, `role_permissions` | all authenticated (read-only reference) | migrations only | migrations only | migrations only |
| `categories`, `brands` | `products.read` | `categories.write` / `brands.write` | same | same, restricted by FK |
| `products`, `product_variants` | `products.read` | `products.write` | `products.write` | archive only |
| `suppliers` | `suppliers.read` | `suppliers.write` | `suppliers.write` | `suppliers.write` if unused |
| `customers` | `customers.read` | `customers.write` | `customers.write` | `customers.write` if unused |
| `inventory_balances` | `inventory.read` | **no direct insert** | **no direct update** | never |
| `inventory_movements` | `inventory.read` | **no direct insert** | never | never |
| `stock_transfers` | `inventory.read` | `inventory.transfer` (draft) | RPC only | draft only |
| `purchase_orders`, items | `purchases.read` | `purchases.write` | `purchases.write` while draft/submitted | `purchases.cancel` |
| `goods_receipts`, items | `purchases.read` | **RPC only** | never | never |
| `orders`, `order_items` | `sales.read` | **RPC only** | RPC only | never |
| `payments` | `finance.read` | **RPC only** | never | never |
| `returns`, `return_items` | `sales.read` | `sales.write` (draft) | RPC only | draft only |
| `expenses` | `expenses.read` | `expenses.write` | `expenses.write` | `expenses.write` if no ledger link |
| `expense_categories` | `expenses.read` | `expenses.write` | `expenses.write` | restricted by FK |
| `financial_transactions` | `finance.read` | **trigger/RPC only** | never | never |
| `audit_logs` | `audit.read` | **trigger only** | never | never |
| `notifications` | own rows | trigger/RPC | own rows (mark read) | own rows |

`inventory_balances`, `inventory_movements`, `goods_receipts`, `orders`,
`payments` and `financial_transactions` have **no client write path**. Writes
happen inside `security definer` RPCs in `private`, which re-check
`private.has_permission` and write the audit entry in the same transaction.

## 5. Privileged functions

```text
private.create_organization(name, timezone, currency)
private.invite_member(org, email, role_key)
private.accept_invitation(token)
private.change_member_role(member_id, role_key)
private.deactivate_member(member_id)
private.receive_purchase_order(po_id, lines, received_at)
private.adjust_stock(location_id, variant_id, quantity_delta, reason)
private.transfer_stock(from_location, to_location, lines, note)
private.record_sale(location_id, channel, lines, payments, customer_id, idempotency_key)
private.complete_return(return_id)
private.record_expense(...)
```

Each function:

1. Derives the organization from the target row and verifies membership.
2. Verifies the required permission (not just membership).
3. Validates quantities, prices and status transitions.
4. Locks affected rows (`select … for update`) before changing balances.
5. Writes the business row, inventory movements and ledger entries atomically.
6. Inserts an audit row with actor, action and a safe diff.
7. Returns a typed result; raises domain errors with stable SQLSTATE codes that
   the server maps to user-facing messages.

`security definer` is used only where RLS would otherwise block a legitimate
multi-table operation, and always with an empty `search_path`.

## 6. Views

- Reporting views use `security_invoker = true` so the caller's RLS applies.
- No view exposes `auth.users`, invitation hashes or full audit payloads.
- A restricted `public.member_directory` view exposes only id, full name, role
  key and status for members of organizations the caller shares.
- Materialized views are not used in Phase 1–5; they would require refresh and
  ownership rules that complicate tenant safety.

## 7. Storage policies

Buckets are private:

| Bucket | Path convention | Read | Write |
| --- | --- | --- | --- |
| `product-images` | `org/<org_id>/products/<product_id>/<file>` | `products.read` | `products.write` |
| `category-images` | `org/<org_id>/categories/<category_id>/<file>` | `products.read` | `categories.write` |
| `expense-attachments` | `org/<org_id>/expenses/<expense_id>/<file>` | `expenses.read` | `expenses.write` |
| `organization-assets` | `org/<org_id>/branding/<file>` | member | `settings.manage` |

The first path segment after `org/` must parse as the caller's organization.
Policies use `(storage.foldername(name))[2]` and `private.has_permission`.
Uploads are validated server-side (MIME, extension, size) in addition to policy.
Downloads use short-lived signed URLs; no bucket is public.

## 8. Security test suite (Phase 2)

pgTAP or Vitest against the local stack must prove:

1. Anonymous requests to every exposed table return zero rows or a permission
   error.
2. A member of organization A cannot select, insert, update or delete any row of
   organization B, including through RPCs.
3. `UPDATE` cannot move a row to another organization (`WITH CHECK` test).
4. A sales user cannot call `receive_purchase_order` or `adjust_stock`.
5. A member cannot change their own role, promote themselves, or deactivate the
   last owner.
6. Inventory balances cannot be updated directly; movements cannot be updated or
   deleted.
7. Audit logs are readable only with `audit.read` and never writable.
8. Storage paths for another organization are rejected on read and write.
9. Expired, reused and cross-email invitations fail.
10. Idempotency keys prevent duplicate sales without leaking the first result to
    another organization.

Until these tests run against a real database, RLS must be treated as unproven.
