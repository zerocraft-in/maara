# Business Rules — Purchases

## 1. Principle

A purchase order is a **commercial commitment**, not stock. Creating, submitting
or approving a purchase order has **no inventory effect**. Stock increases only
when goods are physically received and the receipt is confirmed.

## 2. Lifecycle

```text
draft ──submit──▶ submitted ──receive (partial)──▶ partially_received
  │                   │                                  │
  │                   │                                  └──receive (all)──▶ received
  │                   └──cancel──▶ cancelled
  └──cancel──▶ cancelled
```

| Status | Editable | Stock effect |
| --- | --- | --- |
| `draft` | yes | none |
| `submitted` | limited (notes, expected date) | none |
| `partially_received` | no | receipts applied |
| `received` | no | receipts applied |
| `cancelled` | no | none |

Rules:

- Only drafts can be deleted. Submitted orders are cancelled, never deleted.
- Cancelling after a receipt is not allowed; use a supplier return for the
  received quantity.
- Status changes are performed by RPCs, not by direct updates.
- `received` is set automatically when every line is fully received.

## 3. Totals

Money is integer paise. Percentages are basis points.

```text
line_gross    = quantity × unit_cost_paise
line_discount = round(line_gross × discount_bps / 10000)
line_net      = line_gross − line_discount
line_tax      = round(line_net × tax_rate_bps / 10000)
line_total    = line_net + line_tax

subtotal_paise = Σ line_net
discount_paise = Σ line_discount
tax_paise      = Σ line_tax
total_paise    = subtotal_paise + tax_paise
```

- All rounding is half away from zero and happens per line, never on the grand
  total only.
- The server recomputes every total from the line inputs; client-supplied totals
  are ignored.
- Prices are stored tax-exclusive unless the organization setting
  `tax_inclusive_pricing` is enabled; the setting changes entry and display, not
  the stored representation.
- Negative prices, quantities or rates are rejected.

## 4. Receiving

`private.receive_purchase_order` is the only path that increases stock from a
purchase.

Input: purchase order id, lines `[{ purchase_order_item_id, quantity,
unit_cost_paise? }]`, received date, note.

Behaviour, in one transaction:

1. Lock the purchase order and its item rows.
2. Verify status is `submitted` or `partially_received`.
3. Verify the caller has `purchases.receive` in the order's organization.
4. For each line: `quantity > 0` and
   `received_quantity + quantity <= ordered_quantity`.
5. Create a `goods_receipt` and `goods_receipt_items`.
6. For each line, call the inventory receipt primitive, which:
   - locks the balance row,
   - increases quantity,
   - recalculates weighted average cost,
   - writes a `purchase_receipt` movement linked to the receipt.
7. Update `received_quantity` and the order status.
8. Write the financial transaction for the received value (accounts payable).
9. Write the audit entry.

Partial receiving is normal: an order can produce several receipts over time.
The same line may appear in multiple receipts. Receipts cannot be edited after
creation; a mistake is corrected with a supplier return or an adjustment, both
audited.

### Over-receipt

Rejected by default. A per-organization setting may allow a tolerance (for
example 2%) but it must be explicit and audited. The default is zero.

### Unit cost changes

If the actual receipt cost differs from the ordered cost, the receipt line stores
the actual cost, the purchase order line is updated to it, and weighted average
uses the actual cost. The difference is noted in the audit entry.

## 5. Supplier returns

- A return references the receipt or order line and a quantity that was actually
  received.
- Confirming a return writes a `supplier_return` movement (negative) at the
  original receipt cost.
- The return cannot take stock below zero; if the stock has been sold, the
  return is rejected and the operator must adjust or purchase first.
- Financial effect: reduces the payable / records a refund inflow.

## 6. Numbering

- `purchase_orders.reference` is unique per organization, e.g. `PO-2026-0001`.
- Numbers are allocated by a database function that locks the organization's
  counter row. No `max(reference)+1` queries.
- Gaps are acceptable; duplicates are not.

## 7. Permissions

| Action | Permission |
| --- | --- |
| View orders and receipts | `purchases.read` |
| Create/edit draft, submit | `purchases.write` |
| Receive | `purchases.receive` |
| Cancel | `purchases.cancel` |
| Supplier return | `purchases.receive` + `inventory.adjust` |

Inventory staff can receive but cannot create or edit orders. Accountants can
read but not receive by default (configurable in role permissions).

## 8. UI rules

- The purchase order form shows live totals computed from the same formulas, but
  the server result is authoritative after save.
- The receive dialog shows ordered, already received, outstanding and new
  quantity per line, and blocks submission above the outstanding amount.
- After a receipt, the UI shows the new on-hand quantity and links to the created
  goods receipt and inventory movements.
- A "receive" button never appears on a draft order.
- Destructive actions require confirmation and, where applicable, a reason.

## 9. Acceptance tests

1. Creating a purchase order leaves inventory unchanged.
2. Submitting a purchase order leaves inventory unchanged.
3. Receiving 5 of 10 units sets status `partially_received`, adds 5 to stock and
   writes one movement.
4. Receiving the remaining 5 sets `received` and writes a second movement.
5. Receiving 11 of 10 is rejected and no movement is written.
6. Two concurrent receipts cannot exceed the ordered quantity.
7. A failed receipt leaves no goods receipt, no movement and no ledger row.
8. Weighted average after two receipts at different costs matches the formula.
9. Cancelling after receipt is rejected.
10. A supplier return reduces stock and the payable, and is audited.
