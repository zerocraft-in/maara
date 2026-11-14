# Business Rules — Sales

The admin application **records and manages sales**. It is not a point-of-sale
terminal. Billing screens, barcode scanning, receipt printing, cash drawers and
offline billing belong to the future Maara POS and Van Sales applications, which
will call the same database functions.

---

## 1. Channels

`orders.channel` is one of `shop`, `van`, `online`. The admin can create and
review all three; only `shop` and administrative corrections are expected in this
phase. Channel is required and cannot be changed after completion.

## 2. Order lifecycle

```text
draft ──complete──▶ completed ──return──▶ (return documents)
  │                     │
  └──cancel──▶ void ◀───┘  (void only before any payment is captured)
```

- Drafts exist only inside a single editing session and are never counted in
  reports.
- Completion is one atomic RPC: stock deduction + order rows + payment rows +
  ledger rows + audit row.
- `void` is allowed only when no payment has been captured and no return exists.
  A completed sale with money is reversed by a return, not a void.
- Orders are never deleted.

## 3. Line calculation

```text
line_gross    = quantity × unit_price_paise
line_discount = round(line_gross × discount_bps / 10000)
line_net      = line_gross − line_discount
line_tax      = round(line_net × tax_rate_bps / 10000)
line_total    = line_net + line_tax

subtotal_paise = Σ line_net
discount_paise = Σ line_discount
tax_paise      = Σ line_tax
total_paise    = subtotal_paise + tax_paise
```

- `unit_cost_paise` is a **snapshot** of the location's weighted average cost at
  completion, used later for COGS and margin. It is never recalculated.
- The server recomputes totals from lines. Client totals are display only.
- Discounts can be line-level or order-level; the total discount is the sum. An
  order-level discount is allocated to lines (largest-remainder method) so that
  line totals still add up exactly to the order total.
- Tax is computed on the discounted net. Rounding is half away from zero per
  line.

## 4. Stock deduction

- Every line with a stock-tracked variant deducts from the fulfilling location.
- The RPC locks each balance row, verifies availability, writes a `sale`
  movement, and updates the balance — all in the completion transaction.
- If any line is short, the whole sale fails and nothing is written.
- Services or non-stock items, if introduced later, need an explicit
  `tracks_stock` flag; they do not create movements.
- Over-selling is never allowed by the database. A future POS may show a warning
  before completion, but the database remains the final gate.

## 5. Payments

- `payments` rows are append-only and belong to one order or one purchase.
- Methods: `cash`, `card`, `upi`, `bank`, `credit_note`.
- `paid_paise` is the sum of captured payments minus refunds.
- `payment_status` is derived:
  - `unpaid` when `paid_paise = 0`
  - `partial` when `0 < paid_paise < total_paise`
  - `paid` when `paid_paise >= total_paise`
  - `refunded` when `refunded_paise > 0` and `paid_paise = 0`
- An order may be completed with partial payment (credit sale) only when the
  customer is recorded. The outstanding balance is a customer receivable.
- Payment edits are not allowed; mistakes are corrected with an opposite
  payment/refund row and an audit entry.

## 6. Returns and refunds

A return is a separate document with its own reference, reason and lines.

Rules:

1. Only completed orders can be returned.
2. `return_items.quantity` is cumulative-limited by the sold quantity:
   `sum(previous returns) + new quantity <= order_item.quantity`.
3. A return line inherits the original `unit_price_paise` and
   `unit_cost_paise`; price overrides require `sales.refund` and a reason.
4. `restock = true` writes a `customer_return` movement at the original cost and
   increases the chosen location's balance.
5. `restock = false` (damaged goods) records the refund without increasing stock
   and writes an audit note.
6. Refunds cannot exceed the amount paid for the order. Store credit is recorded
   as a `credit_note` payment row linked to the customer.
7. Completion of the return updates `refunded_paise`, `payment_status`, ledger
   rows and audit in one transaction.

## 7. Idempotency

- Each completion request carries a client-generated `idempotency_key`.
- The key is unique per organization. A repeated request returns the original
  order instead of creating a second sale.
- Keys expire after 24 hours; the row remains for audit until the order is
  archived by retention policy.
- This is required for the future offline van app and is enforced now.

## 8. Numbering

- `order_number` is unique per organization, e.g. `ORD-2026-000123`, allocated by
  a locked counter in the database.
- The invoice number (`invoice_prefix` + counter) is separate and is assigned
  only when an invoice is issued, so voided sales do not consume invoice numbers.

## 9. Permissions

| Action | Permission |
| --- | --- |
| View orders, payments, returns | `sales.read` |
| Create and complete a sale | `sales.write` |
| Void an unpaid sale | `sales.void` |
| Complete a return / refund | `sales.refund` |
| Export sales data | `reports.export` |

Sales staff can record sales but cannot refund, discount above a configured
limit, or void. Discount limits are checked server-side, not only in the UI.

## 10. UI rules

- The sales module lists orders with date, channel, location, customer, total,
  payment status and return status filters.
- The order detail shows the immutable line snapshot, payments, returns and the
  linked inventory movements.
- "Record sale" opens a real form that writes to the database. If the database is
  unavailable, the UI reports the failure and does not show a success state.
- No fake "record sale" toast and no hardcoded sample orders outside the local
  seed environment.

## 11. Acceptance tests

1. A completed sale writes order, items, payment, movements and ledger rows.
2. Selling more than the available quantity fails atomically.
3. Two concurrent sales of the last unit: one succeeds, one is rejected.
4. Reusing an idempotency key returns the same order and does not double-deduct
   stock.
5. A partial return restocks only the returned quantity.
6. A non-restock return records the refund without changing stock.
7. Cumulative returns cannot exceed the sold quantity.
8. A refund larger than the paid amount is rejected.
9. Voiding a paid order is rejected.
10. Channel, location and customer filters return only the caller's organization.
