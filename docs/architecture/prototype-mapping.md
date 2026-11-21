# Prototype → Next.js Mapping

The reference prototype at `D:\projects\maara` is the visual source of truth. This
document fixes the route structure, component ownership and data dependencies before any
screen is converted. It will be updated as each module ships.

---

## 1. Route map

All dashboard routes live under the `(dashboard)` route group and share the application
shell. `(auth)` routes render without the shell.

| # | Prototype module | Next.js route | Server-rendered? | Primary data |
| --- | --- | --- | --- | --- |
| 1 | Overview | `/overview` | yes | aggregated sales, purchases, expenses, inventory |
| 2 | Products | `/products` | yes | products + variants + stock summary |
| 2a | — | `/products/new` | client form | categories, brands, tax classes |
| 2b | — | `/products/[id]` | yes | product, variants, images, movements |
| 3 | Categories | `/categories` | yes | categories, brands, product counts |
| 4 | Inventory | `/inventory` | yes | balances by location, movements |
| 4a | — | `/inventory/transfers` | yes | transfers + lines |
| 5 | Suppliers | `/suppliers` | yes | suppliers, balances |
| 5a | — | `/suppliers/[id]` | yes | supplier, purchases, payments |
| 6 | Purchases | `/purchases` | yes | purchase orders, receipts |
| 6a | — | `/purchases/[id]` | yes | lines, receipts, returns |
| 7 | Sales | `/sales` | yes | orders, payments, returns |
| 7a | — | `/sales/[id]` | yes | order detail, timeline |
| 8 | Customers | `/customers` | yes | customers, lifetime value, balance |
| 8a | — | `/customers/[id]` | yes | profile, orders, notes |
| 9 | Expenses | `/expenses` | yes | expenses, categories |
| 10 | Finance | `/finance` | yes | ledger, P&L summary |
| 11 | Analytics | `/analytics` | yes | facts by date/channel/location |
| 12 | Reports | `/reports` | yes | report jobs, exports |
| 13 | Locations | `/locations` | yes | locations, stock summary |
| 14 | Users & Roles | `/users` | yes | members, roles, permission matrix |
| 15 | Audit Logs | `/audit-logs` | yes | append-only audit entries |
| 16 | Settings | `/settings` | yes | organization settings, preferences |
| — | Login | `/login` | client form | Supabase Auth |
| — | Forgot password | `/forgot-password` | client form | Supabase Auth |
| — | Reset password | `/reset-password` | client form | Supabase Auth callback |
| — | Accept invite | `/accept-invite` | client form | invitation token |
| — | Onboarding | `/onboarding` | client form | organization creation |

`/` redirects to `/overview` once authentication exists. Until Phase 2 it renders the
foundation status page.

## 2. Layout hierarchy

```
app/layout.tsx                  → html, fonts, theme provider, metadata
app/(dashboard)/layout.tsx      → sidebar + topbar + content frame
app/(dashboard)/*/page.tsx      → page header + module content
app/(auth)/layout.tsx           → centered auth card, no shell
```

Shell components (Phase 3):

| Prototype element | React component | Location |
| --- | --- | --- |
| Sidebar + nav registry | `AppSidebar`, `NavItem`, `navigation.ts` | `components/layout/` |
| Header | `Topbar` | `components/layout/` |
| Breadcrumbs | `Breadcrumbs` | `components/layout/` |
| Store selector | `StoreSwitcher` | `components/layout/` |
| Command palette | `CommandMenu` | `components/layout/` |
| Notifications | `NotificationsMenu` | `components/layout/` |
| Profile menu | `UserMenu` | `components/layout/` |
| Theme control | `ThemeToggle`, `ThemeProvider` | `components/layout/` |
| Mobile drawer | `MobileNav` (Sheet) | `components/layout/` |
| Page header | `PageHeader` | `components/shared/` |

## 3. Component mapping

| Prototype | React implementation | Notes |
| --- | --- | --- |
| `.btn`, `.btn--primary` | shadcn `Button` + `buttonVariants` | Restyle to 34px height, 6px radius |
| `.card`, `.card__head` | shadcn `Card` composition | Preserve 1px border, 12px radius, flat shadow |
| `.badge` variants | shadcn `Badge` + tone variants | Channel, payment, stock tones |
| `.kpi` | `KpiCard` feature component | Sparkline optional; real deltas only |
| `.table` | `DataTable` on TanStack Table | Server pagination in Phase 4+ |
| `.pagination` | `TablePagination` | Cursor or page based per dataset |
| `.segmented` | shadcn `ToggleGroup` | Date range, theme, report format |
| `.tabs` | shadcn `Tabs` | Status tabs |
| `.input`, `.select`, `.textarea` | shadcn `Input`, `Select`, `Textarea` | 34px control height |
| `.modal` | shadcn `Dialog` | Same footer anatomy |
| confirmation | `ConfirmDialog` | Destructive tone |
| `.popover` menus | shadcn `DropdownMenu`, `Popover` | Notifications and store switcher |
| `.toast` | Sonner | Bottom-right, 3 max |
| `.tooltip` | shadcn `Tooltip` | Collapsed sidebar only |
| `.empty` | `EmptyState` | Icon, title, guidance, action |
| custom SVG line/donut | Recharts `AreaChart`, `PieChart` | Recreate muted grid and tooltip |
| `.activity` | `ActivityFeed` | Timeline variant |
| `.scaffold-*` | removed | Replaced by real modules |

## 4. Design token translation

The prototype's CSS variables are retained as the canonical palette and mapped into
Tailwind's theme so shadcn primitives inherit the brand automatically.

| Maara token | shadcn semantic token |
| --- | --- |
| `--bg-app` | `--background` |
| `--bg-surface` | `--card`, `--popover` |
| `--text` | `--foreground` |
| `--text-2` | `--muted-foreground` |
| `--border` | `--border` |
| `--accent` | `--primary` |
| `--accent-fg` | `--primary-foreground` |
| `--accent-soft` | `--accent` |
| `--danger` | `--destructive` |
| `--ring` | `--ring` |

Theme switching uses `class="dark"` on `<html>` (next-themes), not `data-theme`, so shadcn
dark variants work. The Maara variable names remain available for chart and status colours.

## 5. Data dependencies per module

| Module | Reads | Writes |
| --- | --- | --- |
| Overview | sales, purchases, expenses, inventory balances, activity | — |
| Products | products, variants, categories, brands, images, stock | product + variant CRUD, archive, image upload |
| Categories | categories, brands, counts | CRUD with delete guard |
| Inventory | balances, movements, transfers, reorder points | adjustment, transfer, receive (via purchases) |
| Suppliers | suppliers, POs, payments | supplier CRUD |
| Purchases | POs, lines, receipts, returns | create PO, receive, return |
| Sales | orders, lines, payments, returns | record sale, refund/return |
| Customers | customers, orders, balances | CRUD, notes |
| Expenses | expenses, categories | create, update, attach file |
| Finance | ledger, period summaries | derived only |
| Analytics | fact views | — |
| Reports | report definitions, jobs | request export, schedule |
| Locations | locations, stock summary | CRUD, settings |
| Users & Roles | members, roles, permissions | invite, role change, deactivate |
| Audit Logs | audit entries | read-only |
| Settings | organization settings, profile | update settings |

## 6. What must not be carried over

- Hash-based routing and string-templated rendering
- Client-only "record sale" flows that resolve with a toast
- Hardcoded sample arrays as the application data source
- Any financial or inventory number calculated in the browser
- The 15 scaffold pages as a substitute for module implementation

## 7. Sign-off checkpoints

1. **Phase 3 visual review:** shell at 1440/1280/1024/768/390, both themes.
2. **Phase 4 module review:** each screen against its prototype intent, with real data.
3. **Phase 7 release review:** accessibility, empty/loading/error states, exports.
