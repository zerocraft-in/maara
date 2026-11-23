# Maara Merch — Frontend Design Plan

Applied using the `frontend-design` skill's two-pass process
(plan → review against brief → build → critique). Subject: clothing retail
management SaaS admin dashboard ("shop floor" for a garment business).

## 1. Subject matter (grounded in the brief)

Maara Merch is used by shop owners and floor staff to run a clothing business:
receive stock, tag garments (S–XL), reconcile takings, manage low stock, run
sales. The vernacular is retail/fabric — garment tags, price stickers, cutting
table, stock on hand, reordering, hangers, spring/summer stock.

Design anchor: the **garment tag / price sticker** — a small, high-contrast
piece of information attached to a larger whole. That informs the accent
strategy: a near-black ink base (fabric), paper-white cards (tags), and a single
amber "tag" accent used sparingly for stock/sale markers only.

## 2. Design plan (pass 1)

### Color — core base palette (6 named hex values)

| Token | Hex | Role |
|-------|-----|------|
| `--ink` | `#111012` | near-black fabric — body text, primary actions |
| `--paper` | `#ffffff` | card / tag surface |
| `--cloth` | `#f4f3f5` | warm-neutral page background (distinct from the generic AI cream `#F4F1EA` by leaning slightly cool/gray) |
| `--dye` | `#0e7c7b` | distinctive brand accent (teal, not acid green / vermilion) — primary buttons, active states |
| `--tag` | `#b45309` | amber clothing tag — stock / sale / low-stock markers only |
| `--muted` | `#e7e5e4` | hairline borders, dividers, subtle structure |

Already present in `globals.css`: `--primary` teal `oklch(0.48 0.13 165)` and
`--tag` `#b45309`. Keep both; they are deliberate, not defaults.

### Type — two families, clearly distinct

- **Display / headlines**: Manrope (geometric sans with personality; already
  referenced as `font-manrope` in `overview/page.tsx` but never loaded —
  wiring it up is part of this test). Used for page titles and section heads;
  the type treatment itself is part of the design, set at a clear type scale.
- **UI / body**: Inter (system fallback stack), used for data, labels, tables,
  forms. One sans for display + one for body would be too similar; Manrope vs
  Inter are clearly distinct in weight and width.

Type scale (The Elements of Typographic Style): h1 28px, h2 15px, body 13px,
caption 11–12px; intentional weights (extrabold display, medium labels,
regular body). Line lengths < 80ch (body already capped at `max-w-[64ch]`).
Serif is deliberately NOT used (no broadsheet default).

### Layout

- Sidebar + fixed header shell (existing `DashboardShell`, unchanged).
- Content area: left-aligned (never justified, no centered headline default).
- One memorable element per page; everything around it quiet. On the overview
  page that's the big stock value; on a tags page it could be a single large
  garment illustration or a bold tag.

### Principles (what makes this page unique)

1. Retail vernacular first: "shop floor," "receive stock," "tag garments" —
   copy names things by what users understand, not by system internals.
2. Restraint: spend boldness in ONE place (the tag amber accent); cut all
   other decoration.
3. No generic defaults per the skill's calibration list: no ALL-CAPS eyebrows,
   no middle dots (`A · B · C`), no `WORD — fragment` labels, no `→` on
   buttons, no identical rounded cards with the same soft shadow, no warm
   cream background, no acid-green accent, no hairline broadsheet rules.
4. Accessibility floor: responsive to mobile, visible keyboard focus,
   prefers-reduced-motion respected, sufficient contrast.

## 3. Review against brief (pass 2)

The plan was checked against the skill's generic-default traits:

- Warm cream #F4F1EA → rejected; using cool warm-neutral `#f4f3f5` (cloth,
  not cream) — subject-justified, not default.
- Near-black + acid green → rejected; brand accent is teal `#0e7c7b`.
- Identical rounded cards + soft grey shadow → rejected; cards use a single
  4px left border in the section accent color, no repeated shadow.
- ALL-CAPS eyebrows / middle dots / → on buttons → absent.
- Single type family default → two clearly distinct families (Manrope +
  Inter).

Plan confirmed as choices made for *this* brief, not defaults. Proceed to
build.

## 4. Build actions (test of the skill)

1. Wire up Manrope via `next/font/google` in `layout.tsx` and define
   `--font-manrope` in `globals.css` (fixes the dangling reference already
   used in `overview/page.tsx`).
2. Add a demo page (`/(dashboard)/design-preview`) that applies the plan to a
   clothing-retail context (a "garment tags" stock-receipt view) so the
   design can be rendered and reviewed.
3. Run `typecheck`, `lint`, `build`, then dev server + Playwright screenshots
   at 1440×900 (desktop) and 390×844 (mobile) per `AGENTS.md`.

## 5. Critique

- Boldness spent in one place: the tag amber is the only saturated accent;
  everything else is ink/paper/cloth/muted. ✓
- One orchestrated motion moment (existing page-load fade-in) preserved; no
  scattered hover transitions on every card. ✓
- Line lengths < 80ch; body 13px/20px leading. ✓
- Responsive + focus-visible + reduced-motion already in `globals.css`. ✓
