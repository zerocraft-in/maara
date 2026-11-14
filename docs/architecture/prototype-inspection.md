# Prototype Inspection Report

**Date:** 12 November 2026
**Reference prototype:** `D:\projects\maara` (read-only — never modified)
**Target application:** `D:\projects\maara-merch`
**Phase:** 0 — Inspect and plan

---

## 1. Source inventory

The reference prototype is a self-contained, framework-free HTML/CSS/JavaScript design
prototype. It opens directly from the filesystem and has no backend, build step, or
package dependencies.

| Area | Files | Notes |
| --- | --- | --- |
| Entry | `index.html` | App shell, header menus, command palette, toast/modal roots |
| Design tokens | `assets/css/tokens.css` | Light/dark palettes, type, spacing, radii, layers |
| Base | `assets/css/base.css` | Reset, typography, utilities, scrollbars |
| Shell | `assets/css/shell.css` | Sidebar, topbar, breadcrumbs, responsive drawer |
| Components | `assets/css/components.css` | Buttons, KPI, tables, forms, overlays, toasts |
| Pages | `assets/css/pages.css` | Overview dashboard grid, module spec pages |
| Core JS | `assets/js/core/` | Theme controller, registry, hash router, utilities |
| UI JS | `assets/js/ui/` | Icons, overlays, charts, data table, prototype actions |
| Pages JS | `assets/js/pages/` | Overview (built), module scaffold (spec) |
| Data | `assets/js/data/sample.js` | Deterministic demo dataset |
| Documentation | — | No README in the reference prototype |

Rendering is string-template based with a single `window.Maara` namespace. Scripts are
classic scripts (not ES modules) so the prototype runs from `file://`.

## 2. What is actually built

**16 navigation modules are registered.** Only one is a functional screen:

| Status | Modules |
| --- | --- |
| Fully designed and interactive | Overview (KPIs, four visualisations, top products, activity, low-stock queue, transactions table, date-range switching, export and record-sale dialogs) |
| Specification scaffold | Products, Categories, Inventory, Suppliers, Purchases, Sales, Customers, Expenses, Finance, Analytics, Reports, Locations, Users & Roles, Audit Logs, Settings |

Scaffold pages are intentional: they document planned surface, draft entities, layout
blueprint and dependencies. They are **not** implementations and must not be mistaken
for finished modules.

### Implemented interaction primitives

- Collapsible fixed sidebar (260px → 72px), grouped navigation, active state, tooltips,
  mobile drawer with scrim
- Header: breadcrumbs, command palette trigger, store selector, theme toggle,
  notifications panel, profile menu
- Command menu (`Ctrl/Cmd + K`): module search, action search, keyboard navigation,
  empty state
- Theme system: light / dark / system, localStorage persistence, pre-paint boot script
  (no flash), system-preference listener
- Data table: search, filter, column sort, pagination, empty state
- Overlays: modal, confirmation dialog, popovers, toasts, tooltips, focus trap
- Responsive rules down to 390px, including table horizontal scroll and stacked KPIs

## 3. Design system as implemented

### Colour (light theme)

| Token | Value | Use |
| --- | --- | --- |
| `--bg-app` | `#f6f6f7` | Application canvas |
| `--bg-surface` | `#ffffff` | Cards, sidebar, header |
| `--bg-inset` | `#f3f3f5` | Tracks, chips, inactive controls |
| `--border` | `#e5e5e9` | Default border |
| `--text` | `#17171a` | Primary text |
| `--text-2` | `#55555f` | Secondary text |
| `--text-3` | `#8a8a95` | Tertiary / metadata |
| `--accent` | `#0f6b5f` | Primary action, active nav, chart 1 |
| `--accent-text` | `#0c5c51` | Accent text on tinted surfaces |

### Colour (dark theme)

| Token | Value |
| --- | --- |
| `--bg-app` | `#0d0e10` |
| `--bg-surface` | `#151619` |
| `--bg-elevated` | `#1a1b1f` |
| `--border` | `#292a30` |
| `--text` | `#f1f1f3` |
| `--text-2` | `#a3a3ad` |
| `--accent` | `#157a6c` |
| `--accent-text` | `#5ecfbb` |

Semantic colours: success `#157f45`, warning `#a35c08`, danger `#b3312f`, info `#2458c0`
(light values). Chart palette: accent teal, muted blue, sand, slate, clay.

### Typography and geometry

- Manrope, weights 400/500/600/700/800
- Scale: 11, 12, 13, 14, 16, 20, 24, 30px; body 13px / 1.55
- Spacing scale: 4 → 48px
- Radii: 4, 6, 8, 12, 16px; badges use small radii, avatars are circular
- Shell: 60px header, 260px sidebar (72px collapsed), 1560px content cap
- Shadows are restrained: 1–2px ambient + a single elevated layer for overlays

### Responsive breakpoints in the prototype

`1360`, `1180`, `1120`, `1080`, `960` (sidebar becomes drawer), `860`, `760`, `560`,
`390` (mobile target). The reference was visually verified at 1440 and ~1000px widths;
target QA widths for the React port are 1440, 1280, 1024, 768 and 390.

## 4. Known issues and conversion risks

These are deliberately recorded so the React implementation does not inherit them.

1. **Search trigger truncation.** At 1000–1180px the header search label truncates and
   the `Ctrl K` hint wraps onto two lines. The React header should collapse the label
   below 1200px and keep the shortcut on one line.
2. **Custom SVG charts.** The prototype charts are hand-rolled SVG. Recharts will replace
   them, but axis density, tooltip styling and muted gridlines must be recreated.
3. **Scaffold pages are not features.** The 15 spec pages must be replaced by real data
   screens; their blueprints are guidance, not acceptance criteria.
4. **No authentication, no tenancy, no persistence.** Every action resolves with a toast.
   Nothing in the prototype may be treated as a business rule implementation.
5. **Client-side state only.** Theme and sidebar preferences are the only persisted values.
6. **Table behaviour is client-side.** The React app needs server-side pagination,
   filtering and sorting for large datasets.
7. **Accessibility coverage is partial.** Focus trap and labels exist, but charts lack
   accessible tabular alternatives, and menus need stronger `aria` wiring in React.
8. **Currency is display-only.** The prototype formats `₹` with `en-IN`; production money
   must be integer paise with `Intl.NumberFormat("en-IN")` only at the edge.
9. **Tax and discount semantics are undefined.** The prototype shows totals but no line
   tax treatment. This must be specified before purchases/sales are implemented.
10. **Dark-theme contrast** of tertiary text on elevated surfaces should be re-checked
    against WCAG AA during component conversion (small 10.5px metadata).

## 5. Data and business assumptions in demo content

The demo dataset uses INR, en-IN grouping, India-style SKUs (`MM-TEE-001`), six product
categories, three sales channels (Shop, Van, Online), five locations (two shops, one
warehouse, one van route, one group), and six roles. These are **sample values**, not
requirements; the production schema is defined in `docs/database/schema.md`.

## 6. Conversion verdict

The prototype is suitable as the visual source of truth. Its tokens, component anatomy,
spacing rhythm and interaction patterns map cleanly to a Next.js App Router application
using Tailwind CSS 4 and shadcn/ui primitives. The main risk is not visual conversion —
it is the absence of any real domain logic, which is why Phases 2–4 (auth, tenancy,
inventory transactions, finance) take priority over broad module coverage.
