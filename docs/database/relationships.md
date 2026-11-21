# Database Relationships

This is the relationship view of `docs/database/schema.md`. Cardinalities are
declared with the intent the migrations must enforce.

## 1. Tenancy

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has
    ORGANIZATIONS ||--o{ STORES : operates
    ORGANIZATIONS ||--o{ LOCATIONS : stocks_at
    ORGANIZATIONS ||--o{ CATEGORIES : owns
    ORGANIZATIONS ||--o{ BRANDS : owns
    ORGANIZATIONS ||--o{ PRODUCTS : owns
    ORGANIZATIONS ||--o{ SUPPLIERS : owns
    ORGANIZATIONS ||--o{ CUSTOMERS : owns
    ORGANIZATIONS ||--o{ PURCHASE_ORDERS : owns
    ORGANIZATIONS ||--o{ ORDERS : owns
    ORGANIZATIONS ||--o{ EXPENSES : owns
    ORGANIZATIONS ||--o{ AUDIT_LOGS : records
    PROFILES ||--o{ ORGANIZATION_MEMBERS : joins
    ROLES ||--o{ ORGANIZATION_MEMBERS : grants
    ROLES ||--o{ ROLE_PERMISSIONS : contains
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : included_in
    STORES ||--o{ LOCATIONS : contains
```

A user reaches business data only through `organization_members`. `profiles` is
the exposed projection of `auth.users`.

## 2. Catalogue and stock

```mermaid
erDiagram
    CATEGORIES ||--o{ PRODUCTS : classifies
    CATEGORIES ||--o{ CATEGORIES : parent_of
    BRANDS ||--o{ PRODUCTS : brands
    PRODUCTS ||--o{ PRODUCT_VARIANTS : has
    PRODUCT_VARIANTS ||--o{ INVENTORY_BALANCES : counted_at
    LOCATIONS ||--o{ INVENTORY_BALANCES : holds
    PRODUCT_VARIANTS ||--o{ INVENTORY_MOVEMENTS : moves
    LOCATIONS ||--o{ INVENTORY_MOVEMENTS : at
    STOCK_TRANSFERS ||--o{ INVENTORY_MOVEMENTS : produces
    STOCK_TRANSFERS }o--|| LOCATIONS : from
    STOCK_TRANSFERS }o--|| LOCATIONS : to
```

`inventory_balances` is unique per `(location_id, variant_id)`. Every balance
change writes an `inventory_movements` row in the same transaction; a transfer
writes an out leg and an in leg sharing `transfer_id`.

## 3. Purchasing

```mermaid
erDiagram
    SUPPLIERS ||--o{ PURCHASE_ORDERS : supplies
    PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_ITEMS : contains
    PRODUCT_VARIANTS ||--o{ PURCHASE_ORDER_ITEMS : ordered_as
    PURCHASE_ORDERS ||--o{ GOODS_RECEIPTS : received_by
    GOODS_RECEIPTS ||--o{ GOODS_RECEIPT_ITEMS : contains
    PURCHASE_ORDER_ITEMS ||--o{ GOODS_RECEIPT_ITEMS : fulfilled_by
    GOODS_RECEIPTS ||--o{ INVENTORY_MOVEMENTS : creates
```

Receiving is the only path from purchasing to stock. A purchase order in `draft`
or `submitted` has no inventory effect.

## 4. Sales and returns

```mermaid
erDiagram
    CUSTOMERS ||--o{ ORDERS : places
    STORES ||--o{ ORDERS : channel_of
    LOCATIONS ||--o{ ORDERS : fulfilled_from
    ORDERS ||--o{ ORDER_ITEMS : contains
    PRODUCT_VARIANTS ||--o{ ORDER_ITEMS : sold_as
    ORDERS ||--o{ PAYMENTS : settled_by
    ORDERS ||--o{ RETURNS : refunded_by
    RETURNS ||--o{ RETURN_ITEMS : contains
    ORDER_ITEMS ||--o{ RETURN_ITEMS : returned_from
    ORDERS ||--o{ INVENTORY_MOVEMENTS : deducts
    RETURNS ||--o{ INVENTORY_MOVEMENTS : restocks
```

Orders store three channel values (`shop`, `van`, `online`) so future POS, van
and storefront clients write to the same table. A return that is restocked
creates a `customer_return` movement; a non-restock return records the refund
without adding stock.

## 5. Money and finance

```mermaid
erDiagram
    ORDERS ||--o{ FINANCIAL_TRANSACTIONS : generates
    PURCHASE_ORDERS ||--o{ FINANCIAL_TRANSACTIONS : generates
    EXPENSES ||--o{ FINANCIAL_TRANSACTIONS : generates
    PAYMENTS ||--o{ FINANCIAL_TRANSACTIONS : posts
    RETURNS ||--o{ FINANCIAL_TRANSACTIONS : posts
    EXPENSE_CATEGORIES ||--o{ EXPENSES : classifies
    SUPPLIERS ||--o{ EXPENSES : billed_by
    LOCATIONS ||--o{ EXPENSES : attributed_to
```

Financial rows are append-only and always point at their source document. The
P&L views aggregate `financial_transactions` and snapshotted line costs; no
report recalculates money from floats.

## 6. Audit and notifications

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ AUDIT_LOGS : owns
    PROFILES ||--o{ AUDIT_LOGS : acts
    ORGANIZATIONS ||--o{ NOTIFICATIONS : owns
    PROFILES ||--o{ NOTIFICATIONS : receives
```

`audit_logs` and `notifications` are written by triggers or server-side trusted
code. Clients have read-only access to audit logs (permission-gated); nothing
client-facing can update or delete either table.
