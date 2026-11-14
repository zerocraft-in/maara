# Business Rules — Inventory

Inventory is the highest-risk domain in the product. All rules here are enforced
in the database, inside transactions, and are not repeated in client code.

---

## 1. Core model

- `inventory_balances` holds the **current on-hand quantity** per variant per
  location, plus the weighted average cost at that location.
- `inventory_movements` is an **append-only journal**. Every quantity change has
  exactly one movement row.
- A balance is never edited directly. There is no client `UPDATE` grant on
  either table; writes occur only through `private` RPCs.
- The invariant that must hold at all times:

```text
balance.quantity = sum(movements.quantity_delta)
  for the same (organization_id, location_id, variant_id)
```

A nightly integrity check verifies this and raises an alert instead of silently
repairing data.

## 2. Movement types and signs

| Type | Sign | Created by | Reference |
| --- | --- | --- | --- |
| `opening` | + | Stock opening RPC | `adjustment` |
| `purchase_receipt` | + | `receive_purchase_order` | `goods_receipt` |
| `supplier_return` | − | Purchase return RPC | `return` |
| `sale` | − | `record_sale` | `order` |
| `customer_return` | + | `complete_return` | `return` |
| `adjustment` | ± | `adjust_stock` | `adjustment` |
| `transfer_out` | − | `transfer_stock` dispatch | `stock_transfer` |
| `transfer_in` | + | `transfer_stock` receipt | `stock_transfer` |

Rules:

- `quantity_delta` is never zero.
- Outflows must not take the balance below zero. The RPC locks the balance row
  (`for update`), re-reads it, then checks availability.
- A manual adjustment requires a non-empty reason and is always audited.
- Movements are immutable. Corrections use a compensating movement that points
  at the same reference and explains the reversal in `note`.

## 3. Transfers

1. Transfer is created as `draft` with source, destination and lines.
2. Dispatch (`in_transit`) writes one `transfer_out` movement per line and
   reduces the source balance. Stock is no longer available at the source.
3. Receipt (`completed`) writes one `transfer_in` movement per line and increases
   the destination balance at the **same unit cost** carried by the outbound
   movement.
4. Cancelling a draft has no stock effect. Cancelling an in-transit transfer is
   not allowed; it must be completed or reversed with a new transfer.
5. Both legs share `transfer_id`, so in-transit quantity is
   `sum(out) + sum(in)` for open transfers, which is always ≥ 0.
6. Source and destination must differ and belong to the same organization.

All steps run in one transaction per state change. A partial transfer is not a
valid state: every line moves together.

## 4. Valuation

Weighted average cost is maintained per `(location, variant)`:

```text
new_qty   = old_qty + received_qty
new_value = old_qty * old_avg + received_qty * receipt_unit_cost
new_avg   = round(new_value / new_qty)        -- integer paise, half away from zero
```

- On outflow, the average cost is unchanged; the movement stores the average at
  the moment of the move.
- On return to stock, cost is the original sale line's `unit_cost_paise` (cost
  snapshot), not the current average, so margin reversals are exact.
- Stock value for a location is `sum(quantity * average_cost_paise)`; for the
  organization it is the sum across locations.
- If `new_qty` is zero, the average cost is retained (not reset to zero) so the
  next receipt starts from a stable basis; it is recalculated from the next
  receipt.

## 5. Low stock

- `product_variants.reorder_point` is a per-variant threshold in units,
  defaulting to 0 (disabled).
- A variant is low stock at a location when
  `quantity <= reorder_point` and `reorder_point > 0`.
- Organization-level low stock counts variants once, using the sum of on-hand
  across active stock-holding locations.
- Low stock is derived data; it is never stored as a flag that can drift.
- Out-of-stock is `quantity = 0` and is reported separately from low stock.

## 6. Adjustments and approval

- `inventory.adjust` can create an adjustment.
- Adjustments above a configurable threshold (default: value > ₹10,000) require
  `inventory.approve` from a different user; the movement is written only after
  approval.
- Adjustment reasons are a fixed list (`damage`, `theft`, `count_correction`,
  `sample`, `expiry`, `other`) plus free text.
- The UI never shows an editable balance field. The adjustment dialog takes a
  delta or a counted quantity, shows the resulting balance, and submits the
  delta.

## 7. Locations

- Only `shop`, `warehouse`, `van` and `online_fulfillment` locations can hold
  stock.
- A location cannot be archived while it has non-zero stock or open transfers.
- Deleting a location is impossible once any movement references it; archive it
  instead.
- Van locations are ordinary locations; route planning and offline sync are out
  of scope.

## 8. Permissions

| Action | Permission |
| --- | --- |
| View balances, movements, valuation | `inventory.read` |
| Adjust stock | `inventory.adjust` (+ `inventory.approve` above threshold) |
| Create/dispatch/receive transfer | `inventory.transfer` |
| Receive purchase | `purchases.receive` |
| Record sale | `sales.write` |
| Complete customer return | `sales.refund` |

## 9. Validation rules

- Quantity must be a positive integer for receipts, sales and returns.
- Negative or fractional quantities are rejected by Zod and by a database check.
- Variant and location must be active and belong to the same organization as the
  document.
- SKU/barcode uniqueness is scoped to the organization.
- A receipt cannot exceed the outstanding quantity on a purchase line.
- A return cannot exceed the net sold quantity on an order line, cumulative
  across previous returns.

## 10. Acceptance tests (Phase 4)

1. Receiving 10 units increases on-hand by 10 and writes one movement.
2. Selling 3 units of a 10-unit balance leaves 7 and writes one negative
   movement.
3. Selling 11 units of a 10-unit balance fails and leaves the balance unchanged.
4. A transfer dispatch reduces the source and increases in-transit; receipt
   increases the destination by the same lines.
5. Cancelling an in-transit transfer is rejected.
6. Editing or deleting a movement fails for every role.
7. Two concurrent sales of the last unit: exactly one succeeds.
8. Weighted average matches a hand-calculated value to the paise across three
   receipts at different costs.
9. Archived category/location with stock cannot be deleted.
10. Every adjustment appears in the audit log with actor and reason.
