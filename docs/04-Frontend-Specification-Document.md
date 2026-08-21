# Frontend Specification — FlexSell Wholesale

| Field | Value |
|---|---|
| **Document version** | 2.0 |
| **Date** | 15 August 2026 |
| **Stack** | Next.js 16 App Router · React 19 · TypeScript 5 · Tailwind CSS v4 |
| **Scale** | 98 pages · 187 components · 21 primitives · 13 stores · 14 services |

---

## Table of contents

1. [Route architecture](#1-route-architecture)
2. [Design tokens](#2-design-tokens)
3. [Typography and spacing](#3-typography-and-spacing)
4. [Component library](#4-component-library)
5. [Component contracts](#5-component-contracts)
6. [State management](#6-state-management)
7. [Data fetching](#7-data-fetching)
8. [Rendering strategy](#8-rendering-strategy)
9. [The four states](#9-the-four-states)
10. [Money presentation](#10-money-presentation)
11. [Dates and ranges](#11-dates-and-ranges)
12. [Forms and validation](#12-forms-and-validation)
13. [Interaction patterns](#13-interaction-patterns)
14. [Accessibility](#14-accessibility)
15. [Responsive design](#15-responsive-design)
16. [Performance](#16-performance)
17. [Browser support](#17-browser-support)
18. [Known debt](#18-known-debt)
19. [Review checklist](#19-review-checklist)

---

## 1. Route architecture

```
src/app/
├── (storefront)/        31 public pages
│   ├── products/[slug]  categories/[slug]  collections/[slug]
│   ├── cart  checkout  order-confirmation/[orderId]
│   ├── login  register  forgot-password  reset-password
│   ├── blogs/[slug]  pages/[slug]  policies/*  faq  about  contact
│   ├── dropshipping  quote  create-order  search  wishlist
│   └── system-diagnostics
├── (dashboard)/
│   ├── client/          12 pages  — orders, Advance, addresses, profile, reviews…
│   ├── admin/           26 pages  — full control
│   └── manager/         29 pages  — permission-scoped
└── api/                 88 route handlers
```

Route groups exist so each shell gets its own layout: the storefront carries the header, mega
menu and footer; the dashboard carries a sidebar and no marketing chrome.

**Dynamic segments** always use the human-readable id (`FS-10042`, not an ObjectId) so a URL is
quotable in a support conversation.

---

## 2. Design tokens

Defined once in `globals.css`, consumed through Tailwind. **Never hardcode a colour** — the app
ships a dark theme and a literal breaks it.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--primary` | `#10b981` | `#10b981` | FlexSell emerald — brand, credits, primary actions |
| `--primary-foreground` | `#ffffff` | `#020817` | Text on primary |
| `--background` | `#ffffff` | `#020817` | Page ground |
| `--foreground` | `#09090b` | `#f8fafc` | Body text |
| `--card` | `#ffffff` | `#091124` | Raised surfaces |
| `--secondary` | `#f1f5f9` | `#1e293b` | Subdued surfaces |
| `--muted-foreground` | `#64748b` | `#94a3b8` | Secondary text |
| `--destructive` | `#ef4444` | `#ef4444` | Errors, destructive actions |
| `--border` / `--input` | `#e2e8f0` | `#1e293b` | Hairlines, field borders |
| `--ring` | `#10b981` | `#10b981` | Focus ring |
| `--radius` | `0.5rem` | — | Corner radius |

The emerald is not arbitrary: it matches the Business Advance banner artwork, so product and
marketing share one identity.

**Semantic colour is separate from the accent.** Success uses `--primary`, danger
`--destructive`, warning the amber scale. A warning must never be rendered in the brand colour.

---

## 3. Typography and spacing

| Purpose | Class | Notes |
|---|---|---|
| Page title | `text-xl font-bold tracking-tight` | One `<h1>` per page |
| Section title | `text-base font-bold` | |
| Card title | `text-sm font-bold uppercase tracking-wider` | Admin surfaces |
| Body | `text-sm` | |
| Secondary | `text-xs text-muted-foreground` | |
| Micro-label | `text-[10px] uppercase tracking-wider` | Table headers, eyebrows |
| Figures | `tabular-nums` | **Mandatory** wherever digits align |

Spacing uses Tailwind's scale via flex/grid `gap`, **not per-element margins** — margins
collapse and double in ways that are hard to trace.

---

## 4. Component library

### 4.1 Primitives — `src/components/ui/` (21)

**Use these before writing anything new.**

| Component | For | Instead of |
|---|---|---|
| `Button` | Every action | A styled `<div>` |
| `Card` + `CardHeader/Title/Description/Content` | Grouped content | A hand-rolled box |
| `Input` | Text, number, date, file | Unstyled `<input>` |
| `Badge` | Status — 6 variants | A coloured `<span>` |
| `EmptyState` | Nothing to show | An ad-hoc paragraph |
| `Skeleton` | Loading | A spinner |
| `Pagination` | Paged lists | Infinite scroll for tabular data |
| `ConfirmDialog` + `confirmStore` | Destructive confirmation | `window.confirm` |
| `ToastContainer` + `toastStore` | Transient feedback | Inline alerts |
| `Drawer` | Mobile overlays | A custom modal |
| `Accordion` | Disclosure sections | Manual show/hide |
| `AnimatedCounter` | Figures that change | A plain span |
| `PriceDisplay` | Price with MRP and discount | Manual `₹` concatenation |
| `Avatar`, `Rating`, `Breadcrumb`, `Barcode`, `ThemeToggle`, `InfiniteScrollTrigger`, `ViewDetailsDialog` | As named | — |

### 4.2 Domain components

| Directory | Count | Contains |
|---|---|---|
| `admin/` | 74 | One manager per entity; `admin/order/`, `admin/invoice/` sub-groups |
| `storefront/` | 45 | Catalogue, cart, checkout, product detail, hero, search |
| `ui/` | 21 | The primitives above |
| `dropshipping/` | 10 | The Dropshipping Hub |
| `Advance/` | 9 | Balance card, breakdown, passbook, dialogs, staff panel, receipt |
| `layout/` | 8 | Header, footer, sidebars, mega menu |
| `managers/` | 5 | `PermissionGuard`, manager shells |
| `documents/` | 3 | Printable invoice, receipt, shipping label |
| `common/`, `auth/`, `shared/` | 7 | Cross-cutting |

---

## 5. Component contracts

The contracts a new engineer will actually need.

### `AdvanceBalanceCard`

```ts
{
  type: "store" | "business";
  Advance: AdvanceView | null;      // null renders ₹0, not an error
  actions?: React.ReactNode;      // e.g. the Add Money button
  notice?: React.ReactNode;       // e.g. the KYC banner
}
```

A `null` Advance is *not* an error — lazy creation means the document may simply not exist yet,
so it renders ₹0 in the same layout.

### `AdvancePassbook`

```ts
{
  data: AdvanceStatementPage | null;
  isLoading?: boolean;
  error?: string | null;          // rendered distinctly — never as an empty table
  onPageChange?: (page: number) => void;
  onRaiseQuery?: (id: string, label: string) => void;
  showStatus?: boolean;           // staff see pending/failed rows
  filters?: React.ReactNode;
  bare?: boolean;                 // drop Card chrome when nested in an Accordion
}
```

### `AdvanceBreakdown`

```ts
{
  data: AdvanceBreakdown | null;
  isLoading?: boolean;
  error?: string | null;
  onSelectCategory?: (key: string) => void;
  rangeControl?: React.ReactNode;
  bare?: boolean;
}
```

**The list is the source of truth; the donut is decoration.** Every figure is readable without
the chart, so screen readers, printed statements and a failed chart render all still answer the
question. That ordering also decides the mobile layout — the list never shrinks to fit the
circle.

### `DateRangePicker`

```ts
{ value: DateRange; onChange: (r: DateRange) => void; }
```

Emits nothing until a custom range has **both** dates. A half-filled range would produce an
empty statement, and an empty statement with no explanation reads as lost money.

### `Accordion`

```ts
{
  id: string;                     // wires aria-controls / aria-labelledby
  title: React.ReactNode;
  summary?: React.ReactNode;      // right-aligned, outside the button
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
```

Content stays mounted and is hidden with `hidden` rather than unmounted — collapsing must not
throw away loaded data and re-run an aggregation on the next open.

### `ConfirmDialog` — via `confirmStore`

```ts
confirmAction({
  title: string;                  // name the amount and the subject
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  onConfirm: () => void | Promise<void>;
});
```

**Title convention:** `"Add ₹50,000 to Sharma Traders' Business Advance?"` — *"Are you sure?"*
prevents nothing; the wrong subject is the likelier mistake.

---

## 6. State management

### 6.1 Stores (13)

| Store | Holds |
|---|---|
| `authStore` | Signed-in customer |
| `cartStore` | Line items, tier resolution, tax calculation |
| `orderStore` | Orders, creation, transitions |
| `productStore`, `categoryStore`, `collectionStore` | Catalogue caches |
| `wishlistStore`, `invoiceStore`, `hsnStore`, `inventoryHistoryStore` | Feature state |
| `toastStore`, `confirmStore` | UI services |
| `dashboardViewStore` | Active tier for multi-tier customers |

### 6.2 What goes where

| Kind | Home |
|---|---|
| Server data used across pages | Zustand store |
| Server data on one page | `useState` in the page |
| Form fields | `useState`, or `react-hook-form` on long forms |
| UI services (toast, confirm) | Zustand — needed from anywhere |
| Derived values | `useMemo`, never a second state |

**Never mirror server data into state you then mutate.** Refetch instead. A locally mutated
balance that disagrees with the server is a bug the user reports as "my money changed".

---

## 7. Data fetching

```
Component  →  service (src/services/*)  →  apiClient  →  /api/*
```

**No component calls `fetch` directly.** `apiClient` owns CSRF token attachment, base-URL
resolution, error shape (`ApiError`) and mock-mode fallback. Bypassing it loses all four, and
the failure is silent until a token rotates.

### Mock mode

`isMockMode` gives services a `localStorage` fallback for offline development. **The Advance
service departs from this deliberately: reads may be faked, writes always throw.**

> A mocked top-up that reports success teaches the interface that money moved when nothing did,
> and the same code path in the wrong environment is a phantom balance.

### Cancellation

Every effect that fetches must guard against a late response:

```ts
React.useEffect(() => {
  let cancelled = false;
  service.get().then(d => !cancelled && setData(d));
  return () => { cancelled = true; };
}, [dep]);
```

---

## 8. Rendering strategy

| Content | Strategy | Why |
|---|---|---|
| Product / category / collection | ISR + `generateStaticParams` | SEO and speed |
| Storefront listings | ISR, revalidated on write | Mostly static |
| Cart, checkout | Client | Per-session |
| Dashboards | Client against `no-store` | Never cacheable |
| **Advance** | `force-dynamic` + `no-store` | One customer seeing another's balance is the worst possible bug |

Every data route has a `loading.tsx` **shaped like its content** — the product page shows a
gallery-and-panel skeleton, the Advance shows balance blocks. Never a centred spinner: it tells
the reader nothing and makes real content jump when it arrives.

---

## 9. The four states

Every data surface handles all four. For money they must never be confusable.

| State | Treatment |
|---|---|
| **Loading** | `Skeleton` shaped like the content |
| **Empty** | `EmptyState` — title, explanation, and the action that fixes it |
| **Error** | What failed, and Retry |
| **Zero** | The real value — `₹0` — rendered plainly |

```tsx
{error   ? <ErrorPanel message={error} onRetry={reload} />
: loading ? <Skeleton className="h-56 w-full" />
: !data   ? <EmptyState title="No transactions yet" description="…" />
:           <Content data={data} />}
```

**A failed balance fetch must never render as ₹0.** A customer has to be able to tell "could
not load" from "your money is gone". The Advance page keeps `summaryError` separate from
`summary === null` for exactly this reason.

---

## 10. Money presentation

| Rule | Detail |
|---|---|
| One formatter | `formatPrice` from `lib/utils`. Never hand-roll `₹` + `toFixed` |
| Indian grouping | `1,20,000`, not `120,000` — `en-IN` |
| Tabular numerals | `tabular-nums` wherever digits align |
| **Credits emerald, debits not red** | A statement where every ordinary expense is red reads as an error log. Red is reserved for what actually went wrong |
| True minus sign | `−` (U+2212), not a hyphen — a hyphen reads as a dash at small sizes |
| Never expose paise | Conversion happens at the API edge |
| Name the shortfall | *"₹2,300 short"*, not *"insufficient balance"* — the first is actionable |

---

## 11. Dates and ranges

Every date passes through `lib/datetime.ts`. **No component calls `toLocaleString`.**

| Helper | Output |
|---|---|
| `formatDateIST` | `15 Aug 2026` |
| `formatDateTimeIST` | `15 Aug 2026, 6:04 pm` |
| `formatFullIST` | Full date, time and zone |
| `toISTDateKey` | `2026-08-15` for date inputs |
| `formatRelativeIST` | `2 hours ago` |

`toISTDateKey` exists because `toISOString().slice(0,10)` rolls over at 05:30 IST — between
midnight and 5:30am a date picker's minimum was yesterday in India.

Ranges use `lib/dateRange.ts`, anchored on the **Indian financial year** (1 April – 31 March):

```ts
resolveRange("this_fy")        // 1 Apr of the current FY → now
resolveRange("last_month")     // 1st → actual last day
resolveRange("all")            // no boundaries — never an arbitrary epoch
resolveRange("custom", { from, to })
```

31 March 2026 belongs to FY 2025-26, which a calendar-year assumption gets wrong.

---

## 12. Forms and validation

| Rule | Detail |
|---|---|
| Errors inline, beside the field | Never `alert()` |
| Validate on blur, re-validate on change | Not on every keystroke |
| Submit disabled until valid | And while submitting |
| Required marked with `*` | And `required` on the input |
| Server error surfaced verbatim | The server writes for humans |
| Long forms use `react-hook-form` + Zod | Short ones use `useState` |

**Client validation is UX; the server is the authority.** Every rule enforced in a form is
enforced again in its route.

---

## 13. Interaction patterns

### Destructive actions

`ConfirmDialog` naming the subject and the amount. For money over ₹50,000, the admin's password
in the same dialog — never a second prompt.

### Irreversible actions

State the irreversibility in the message, not just the title:

> *"This cannot be reversed. Business Advance balance can only be spent on services and can
> never move back to the Store Advance or be withdrawn."*

### Double-submit protection

Three layers, because the first two are not guarantees:

1. Disable the button on click — UX only
2. An `isSubmitting` flag
3. **An idempotency key minted when the form opens** — the actual guarantee

### Optimistic updates

**Not used for money.** A balance is refetched after a write. Everywhere else optimism is fine;
here a rolled-back optimistic balance is indistinguishable from money disappearing.

### Toasts

Success and transient info only. Errors that need action get an inline panel with a retry —
a toast disappears before the reader has decided what to do.

---

## 14. Accessibility

Target: **Lighthouse Accessibility 100**, mobile and desktop.

| Requirement | Applied |
|---|---|
| Semantic markup | Balances in `<dl>`; passbook a real `<table>` with `<caption>`, `<th scope>`, `<tfoot>` |
| Icon-only controls | `aria-label` with row context — *"Download bill for Facebook Ads, 16 August"* |
| Live regions | `aria-live="polite"` on balances after a transaction |
| Reduced motion | `AnimatedCounter` renders the final figure immediately; transitions disabled |
| Focus | Visible on every interactive element; returns to the trigger when a dialog closes |
| Colour | Never the only signal — sign and column carry meaning too |
| Keyboard | Every flow completable without a mouse |
| Headings | One `<h1>`, no skipped levels |
| Forms | Every input labelled; errors linked with `aria-describedby` |
| Tabs | `role="tablist"` / `role="tab"` / `aria-selected` |
| Disclosure | `aria-expanded` + `aria-controls` |

---

## 15. Responsive design

Mobile-first. Breakpoints: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

| Pattern | Behaviour |
|---|---|
| Sidebars | Collapse to a `Drawer` below `lg` |
| Wide tables | `overflow-x: auto` **on their own container** — the page body must never scroll sideways |
| Passbook | Stays a table, scrolls horizontally, **Date column frozen** (`position: sticky; left: 0`) |
| Donut + list | Side by side above `sm`, stacked below — the donut never shrinks to fit |
| Dialogs | Bottom sheet on mobile, centred modal above `sm` |
| Product grid | 2 → 3 → 4 columns |
| Admin tables | Horizontal scroll; no column hiding — staff need every field |

---

## 16. Performance

| Technique | Where |
|---|---|
| Intent-based prefetch | `ProductCard` prefetches on hover and touch-start, once |
| Above-fold priority | `isAboveFold` gates `priority` on images |
| Lazy carousel slides | `shouldRenderSlide` defers off-screen images |
| Server-side aggregation | Breakdown and register totals are `$group` |
| Server-side pagination | 50 rows per page |
| Field projection | `productProjection.ts` excludes heavy fields from lists |
| Fixed aspect ratios | Banner carousels reserve space — no layout shift |
| Route-level `loading.tsx` | Instant feedback on navigation |

### Budgets

| Metric | Target |
|---|---|
| LCP | < 2.5s on 4G |
| CLS | < 0.1 |
| INP | < 200ms |
| Route JS | < 200 KB gzipped |

---

## 17. Browser support

| Browser | Minimum |
|---|---|
| Chrome / Edge | Last 2 versions |
| Safari | 16+ |
| Firefox | Last 2 versions |
| iOS Safari | 16+ |
| Chrome Android | 120+ |

Viewport 360px – 2560px. Both themes fully designed — dark is not an afterthought.

**Not supported:** Internet Explorer, and browsers with JavaScript disabled (the dashboard is
inherently interactive; storefront pages degrade to readable static content).

---

## 18. Known debt

| Issue | Impact | Ticket |
|---|---|---|
| `window.alert` / `prompt` in `ConfirmOrderStep`, `FulfillmentForm`, `StaffAdvancePanel` | Blocks the tab, unstyleable, reads as a browser warning | FS-204, FS-501 |
| Admin and manager pages duplicated | ~400 lines duplicated; two missed updates in one release | FS-301 |
| Advance receipt not reachable from the passbook | The document renders; nothing opens it | FS-203 |
| No screen for expense categories | API-only | FS-202 |
| No screen for the offline-credit register | API-only — and it is what makes cash credits reviewable **together** | FS-201 |
| Advance page fetches client-side | Correct for cache safety, but shows a loading step every visit | FS-503 |
| Empty vs error inconsistent on older admin screens | A failed load reads as "no data" | FS-502 |
| Active category filter shown only as a Clear button | Minor confusion | FS-505 |

---

## 19. Review checklist

Before opening a pull request:

- [ ] No `fetch` outside `src/services/`
- [ ] No hardcoded colours — tokens only
- [ ] No `toLocaleString` — `lib/datetime.ts` only
- [ ] No `window.alert` / `confirm` / `prompt` — use the stores
- [ ] Money through `formatPrice`; paise never reach a component
- [ ] All four states handled (loading, empty, error, zero)
- [ ] Wide content scrolls in its own container
- [ ] Icon-only controls have contextual `aria-label`s
- [ ] Keyboard-navigable; focus returns after a dialog closes
- [ ] Both themes checked
- [ ] Types in `src/types/`, no `any`
- [ ] `npm run typecheck && npm run test && npm run build` pass
