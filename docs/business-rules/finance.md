# Business Rules — Finance

Finance is derived from operational documents. No financial figure is calculated
or stored only in the browser.

---

## 1. Units and sources

| Concept | Representation |
| --- | --- |
| Money | `bigint` integer paise, never float |
| Percentages, tax | basis points (`int`, 10000 = 100%) |
| Period | organization timezone, default `Asia/Kolkata` |
| Currency | INR in Phase 1; `organizations.currency` exists for later |
| Source of truth | orders, order_items, purchase receipts, expenses, payments, returns |

Every financial transaction references its source document. There are no manual
journal entries in the UI; corrections happen through the source workflow.

## 2. Definitions

```text
Revenue (net)        = Σ order_items.line_net  for completed orders in period
                       − Σ return_items.line_net for completed returns in period
COGS                 = Σ order_items.quantity × order_items.unit_cost_paise
                       − Σ return_items.quantity × original unit_cost_paise
Gross profit         = Revenue − COGS
Operating expenses   = Σ expenses.amount_paise in period
Net profit           = Gross profit − Operating expenses
Gross margin (bps)   = round(Gross profit × 10000 / Revenue)   when Revenue > 0
Net margin (bps)     = round(Net profit × 10000 / Revenue)     when Revenue > 0
```

- `line_net` excludes tax. Tax collected is a liability, not revenue.
- Discounts are already netted out of `line_net` by the sales rules.
- Revenue is recognised when an order is completed (`placed_at`), not when cash
  is collected. Cash flow is reported separately from payment rows.
- Returns reduce revenue and COGS in the period the return is completed.
- Purchases affect COGS through inventory cost when items are sold, not when they
  are bought. Buying stock is not an expense.
- Expenses are recognised on `expense_date`.
- Opening balances are not revenue or expense.

## 3. Inventory value

```text
inventory_value(location) = Σ inventory_balances.quantity × average_cost_paise
inventory_value(org)      = Σ over active stock-holding locations
```

- Inventory value is an asset, not an expense.
- Write-downs caused by damage are recorded as an adjustment movement plus an
  expense only when the organization explicitly classifies the write-off; the
  adjustment alone changes quantity and value.

## 4. Payments and receivables

- A sale can be paid in full, partially, or on credit.
- Customer outstanding = `Σ order.total_paise − Σ captured payments + Σ refunds`
  for that customer.
- Supplier payable = `Σ received purchase value − Σ supplier payments − Σ
  supplier returns` plus `opening_balance_paise`.
- `payments` rows are append-only. Corrections are new opposite rows.
- Payment status on orders and purchase orders is derived from payment rows and
  refreshed in the same transaction, never edited directly.

## 5. Financial transactions ledger

`financial_transactions` is the reporting spine:

| Source | Direction | Amount |
| --- | --- | --- |
| Sale completion (cash/bank portion) | inflow | captured amount |
| Sale on credit | none until paid; receivable tracked | — |
| Customer payment | inflow | payment amount |
| Customer refund | outflow | refund amount |
| Purchase receipt | outflow (payable recognition) | received value |
| Supplier payment | outflow | payment amount |
| Expense | outflow | expense amount |
| Stock adjustment write-off | none (inventory value only) | — |
| Opening balance | explicit opening row | entered value |

Rows describe cash or payable movement, not revenue. Revenue and COGS come from
order lines. This separation prevents the common double-counting bug.

## 6. Reports

All reports accept `from`, `to`, `location_id`, `channel` and are computed in the
database:

| Report | Basis |
| --- | --- |
| Sales | completed orders, grouped by day/location/channel |
| Purchases | received value from goods receipts, not ordered value |
| Inventory | current balances and valuation snapshot |
| Stock movement | `inventory_movements` in period, grouped by variant/location |
| Profit and loss | revenue, COGS, gross profit, expenses, net profit |
| Expenses | expenses by category and period |
| Location | revenue, COGS, expenses, stock value per location |
| Product performance | units, revenue, COGS, margin by variant/product |

Rules:

- Reports use the same query builder as CSV export; the exported rows are the
  rows on screen.
- Pagination is server-side. Aggregates are computed in SQL, not by summing page
  data in the client.
- Empty periods return zeros with an empty state, never `NaN` or `Infinity`.
- A report over a large range runs as a bounded query; if it would exceed the
  statement timeout it is queued as an export job instead of blocking the page.

## 7. Rounding

- All calculations are integer paise.
- Percentage application uses half-away-from-zero rounding per line.
- Aggregates sum already-rounded lines; they are not recomputed from percentages.
- Margin in basis points is rounded once, at the final division.
- The UI formats with `Intl.NumberFormat("en-IN")`; it never does arithmetic on
  formatted strings.

## 8. Period and timezone

- A "day" is the calendar day in the organization timezone, converted to a UTC
  `timestamptz` range for the query.
- Changing the organization timezone does not rewrite historical documents; it
  changes future reporting boundaries. This is stated in Settings.
- Date ranges are inclusive of the start date and exclusive of the end date at
  midnight, which is documented in the report footer.

## 9. Audit

- Every posted financial row is traceable to its source and actor.
- Expenses, payments, returns and receipt postings are audited.
- Audit logs and financial transactions are append-only; there is no client
  update/delete path.
- Deleting an expense is only allowed before it posts to the ledger; afterwards
  it must be reversed with an explicit correction.

## 10. Acceptance tests

1. Revenue excludes tax and includes discounts correctly.
2. COGS uses the cost snapshot from the sale, not the current cost.
3. A receipt does not change profit at the moment of purchase.
4. Selling received stock produces the expected gross profit to the paise.
5. A partial return reverses revenue, COGS and stock proportionally.
6. An expense reduces net profit in its own period only.
7. Payment status changes never alter revenue.
8. Reports and CSV export return identical totals.
9. Zero-revenue periods render zero margins without division errors.
10. Cross-organization data never appears in any financial aggregate.

## 11. Known decisions to confirm

| Decision | Current assumption |
| --- | --- |
| Costing method | Moving weighted average per location |
| Tax recognition | Tax-exclusive line values; tax is a liability |
| Revenue timing | On order completion |
| Returns timing | On return completion, in that period |
| Credit sales | Allowed with a customer record; receivable tracked |
| Rounding | Half away from zero, per line |
