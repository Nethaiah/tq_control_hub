# Prompt: Frontend Prototype for Techquarters Management Hub

Use this prompt in this repository to build a frontend-only prototype from `PRD.md`.

## Role

You are Codex acting as a senior Next.js product engineer and frontend design lead. Build a polished, realistic, frontend-only prototype for Techquarters Management Hub so the owner can visualize the product before the backend is added.

This is not a marketing site. The first screen must be the actual owner cockpit.

## Required Local Context

Before coding, carefully read:

- `PRD.md`
- `.agents\skills\nextjs-developer\SKILL.md`
- `.agents\skills\frontend-design\SKILL.md`
- `.agents\skills\shadcn\SKILL.md`
- Relevant local Next.js documentation under `node_modules/next/dist/docs/`

Use those files as the source of truth for architecture, App Router patterns, frontend design quality, and shadcn usage.

## Existing Stack

Use the current repository stack:

- Next.js 16+
- React 19+
- App Router only
- TypeScript
- Tailwind CSS v4
- shadcn/ui with `components.json`
- shadcn style: `base-mira`
- shadcn base: Base UI
- lucide icons
- Zod
- React Hook Form
- Sonner
- Biome
- pnpm

Do not introduce a backend yet. Do not call Supabase, Claude, n8n, Stripe, bank feeds, or any external API. Build realistic typed mock data and frontend interactions that make future backend replacement straightforward.

## Product Thesis

Techquarters Management Hub is an internal decision tool for the owner of a technology services agency.

The interface must answer this question in under 60 seconds:

> Are we okay, and what do I do this week?

The prototype should make the sample month from `PRD.md` obvious:

- Positive month
- Clear margin
- Heavy development cost base
- Marketing spend that can be tested against CAC
- Ledger is the source of truth
- Every KPI/chart can drill down to ledger rows
- AI proposes, human commits

## Prototype Scope

Build enough frontend to visualize the MVP and the future product direction.

Required prototype surfaces:

- Dashboard
- Ledger
- Departments
- Category Settings
- CSV Import Review
- AI Insights

Optional but useful later-phase stubs:

- People / Team
- Calendar
- Settings / Integrations

If you add later-phase routes, keep them clearly marked as preview or next phase. Do not let them distract from Dashboard, Ledger, Departments, Category Settings, CSV Import, and AI Insights.

## Architecture Goals

Improve the frontend architecture now so backend work can be added later without rewriting the app.

Use this kind of structure:

```text
src/
  app/
    layout.tsx
    page.tsx
    (workspace)/
      layout.tsx
      dashboard/
        page.tsx
        loading.tsx
        error.tsx
      ledger/
        page.tsx
      departments/
        page.tsx
      categories/
        page.tsx
      imports/
        page.tsx
      insights/
        page.tsx
      calendar/
        page.tsx
      people/
        page.tsx
      settings/
        page.tsx
  components/
    app-shell/
    charts/
    common/
    ui/
  features/
    dashboard/
      components/
      lib/
    ledger/
      components/
      lib/
    departments/
      components/
      lib/
    categories/
      components/
      lib/
    imports/
      components/
      lib/
    insights/
      components/
      lib/
  data/
    seed.ts
    mock-repository.ts
  domain/
    schemas.ts
    types.ts
    filters.ts
    metrics.ts
    currency.ts
  hooks/
    use-url-filters.ts
  lib/
    format.ts
    utils.ts
```

Adjust the exact file layout if the existing repo suggests a better local pattern, but keep these boundaries:

- `domain/` owns Zod schemas, derived types, filter types, currency helpers, and metric calculations.
- `data/` owns seed data and the mock repository.
- `features/*` owns feature-specific UI and feature-specific helpers.
- `components/ui` remains shadcn-generated primitives.
- `components/app-shell` owns sidebar, topbar, workspace nav, and layout chrome.
- `components/charts` owns reusable chart primitives.
- `app/(workspace)` owns routes and server/client composition.

Do not put all UI in `src/app/page.tsx`. Keep route pages thin and feature components organized.

## Backend-Ready Rules

Even though this is frontend-only, model it like the backend is coming next.

- Use Zod schemas for PRD entities: transactions, departments, categories, clients, people, recurring items, calendar events, csv imports, AI suggestions.
- Derive TypeScript types from Zod.
- Keep mock data shaped like future Supabase rows.
- Use one `transactions` model with `type: "revenue" | "expense"` unless the PRD forces otherwise.
- Include `currency`, `fxRate`, and reporting helpers so AED operating currency can report in USD.
- Treat categories and subcategories as data, never hardcoded UI constants.
- Represent filters as one composable filter object.
- Apply the same filter object to ledger rows, totals, charts, and drill-down links.
- Make URL state shareable for filters.
- Put aggregations in pure functions that can later move behind server queries or SQL views.
- Simulate server-side aggregation by computing from repository functions, not by burying ad hoc calculations inside components.
- All derived KPIs must be traceable to transaction IDs.
- Use stable IDs in seed data so drill-down and selection behavior feels real.

## Rendering and Next.js Rules

Follow the local `nextjs-developer` skill and Next.js docs:

- Use App Router.
- Keep Server Components as the default.
- Add `"use client"` only where interaction is required.
- Use client components for interactive filters, inline editing, staged import review, tabs, drawers, and form state.
- Use route-level `metadata` or `generateMetadata`, not JSX `<title>`.
- Add loading and error states where route-level async boundaries are used.
- Use `next/font` from `src/app/layout.tsx`.
- Use `next/image` if content images are introduced.

## shadcn Rules

Follow `.agents\skills\shadcn\SKILL.md` and its rules.

- Use the repo aliases from `components.json`: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`.
- Use lucide icons because `components.json` has `"iconLibrary": "lucide"`.
- Use semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`, etc.) instead of raw Tailwind colors.
- Put custom theme tokens in `src/app/globals.css`, not a new CSS file.
- Use `gap-*`, not `space-x-*` or `space-y-*`.
- Use `size-*` where width and height are equal.
- Use `cn()` for conditional classes.
- Use `Badge` for statuses, `Alert` for callouts, `Skeleton` for loading, `Separator` instead of raw dividers, and Sonner for toasts.
- Use `FieldGroup`, `Field`, `FieldLabel`, and related shadcn form components for forms.
- Use React Hook Form plus Zod for manual transaction entry, CSV mapping, category editing, and AI query forms.
- Icons inside `Button` should use `data-icon="inline-start"` or `data-icon="inline-end"` with no manual icon sizing.
- Dialog, Sheet, and Drawer must include accessible titles.

Before adding new shadcn components, use the project package runner and inspect docs:

```bash
pnpm dlx shadcn@latest info --json
pnpm dlx shadcn@latest docs button card table tabs dialog sheet select badge alert skeleton separator
```

If the network or CLI is unavailable, use existing installed UI components and create only app-specific components under `src/components/common` or `src/features/*/components`. Do not hand-copy registry code from random sources.

## Design Direction

Use `.agents\skills\frontend-design\SKILL.md`.

Before implementation, create a short internal design plan:

- Subject: owner cockpit for a UAE-based technology services agency.
- Audience: business owner who needs fast weekly financial decisions.
- Job: show business health, risks, and exact ledger evidence.
- Visual direction: quiet executive operations room, not generic fintech SaaS.

The design must be dense enough for repeated use, but still clear at a glance.

Avoid:

- A marketing landing page
- Oversized hero sections
- Decorative gradient blobs or orbs
- Nested cards
- One-note purple/blue dashboards
- Raw color classes for status
- Text explaining how the app works instead of making the app usable

Suggested visual system:

- Background: warm off-white or neutral workspace surface
- Foreground: dark graphite/ink
- Primary action: controlled teal or blue
- Risk: amber
- Destructive: semantic destructive token
- Revenue, expense, and margin should have clearly distinct chart tokens
- Card radius should stay restrained, around 8px or less unless existing shadcn tokens require otherwise

Signature product element:

Add a "ledger trace" affordance. Every KPI card and chart panel should show a small source-row count or filter chip like `24 ledger rows`, and clicking it should navigate to the Ledger route with the matching filters applied. This makes the PRD's traceability requirement visible in the prototype.

## Seed Data

Use the sample revenue and expenses from `PRD.md`.

Include enough additional mock rows to make charts and trends believable, but keep the PRD sample month clearly represented. If you add extra months, keep them realistic and typed.

Minimum seed entities:

- Departments: Development, Onboarding, Sales, Design, Marketing, Operations
- Revenue categories: One off build, Monthly retainer, AI subscription, Consulting
- Expense categories: Payroll, Ad spend, Software, Tools, Contractors, Professional services
- Clients: Client A, Client B, Client C, Client D, Client E
- Vendors: Internal, Meta, n8n, Supabase / Vercel, Claude API, Freelancer, Accountant

Model AED operating currency and USD reporting. If the sample values are USD, store `currency: "USD"` for those rows and include `fxRateToUsd: 1`. Add a few AED rows only if it helps visualize multi-currency reporting.

## Required UI Details

### App Shell

- Left sidebar or compact top navigation for main sections.
- Owner context in header: reporting currency, date range, last import status, current filter count.
- Quick actions: Add transaction, Import CSV, Ask AI.
- Responsive behavior for mobile and desktop.

### Dashboard

The dashboard must open by default and answer the owner question quickly.

Top section:

- Net profit
- Net margin %
- MRR
- Cash runway in months
- Anomaly flag count

Each KPI shows:

- Current value
- Change vs previous period
- Direction
- Source row count / ledger trace link

Charts:

- Revenue vs expenses over time
- MRR trend with movement
- Revenue by department
- Expense breakdown by category
- Profit margin trend
- Department P&L table
- Revenue type split
- Top clients by revenue with concentration callout
- Budget vs actual by department

If no chart library is installed, create lightweight responsive SVG/CSS chart components in `src/components/charts`. Keep chart props typed and reusable. Do not add a heavy chart dependency unless necessary and approved.

### Ledger

The ledger is the source of truth.

Required table columns:

- Date
- Type
- Description
- Amount
- Currency
- Department
- Category
- Subcategory
- Client/vendor
- Recurring
- Source
- Attachment

Required interactions:

- Stackable filters: department, category, type, date range, client/vendor
- Search across description, client, and vendor
- Visible removable filter chips
- URL-shareable filter state
- Running totals based on active filters
- Inline editing prototype with optimistic local update
- Undo toast for edits
- Row selection
- Bulk edit department/category prototype
- Fast add transaction form using React Hook Form and Zod

Frontend-only is fine, but make interactions feel real.

### Departments

Show each department as a mini business:

- Revenue
- Cost
- Contribution margin
- Headcount
- Budget vs actual
- Trend

Clicking a department should navigate to either:

- Department detail route, or
- Ledger route with the department filter applied

Use whichever is faster, but keep the URL state explicit.

### Category Settings

Show that categories are configurable data:

- Revenue and expense category lists
- Subcategories
- Rename/archive prototype actions
- Categorization rules
- Recurring item templates
- CSV mapping rules

Use forms with React Hook Form and Zod. Prototype persistence can be local state.

### CSV Import Review

Visualize the messy CSV pipeline:

- Upload zone mock
- Detected delimiter/header/encoding summary
- Column mapping form
- Validation summary
- Duplicate warning
- Staging review table
- AI category suggestions with confidence
- Low-confidence rows requiring human confirmation
- Commit approved rows button
- Import audit record

Uploading the same file twice must be represented as blocked or warned. Since this is frontend-only, simulate this with mock import metadata.

### AI Insights

Build at least two AI feature prototypes:

- Automatic categorization suggestions
- Natural language query

Guardrails must be visible:

- Confidence score
- Human review state
- "Apply suggestion" action
- "Dismiss" action
- Traceability to rows or filters
- Clear copy that AI suggestions are drafts until confirmed

Natural language query should convert a sample owner question into filters or a chart view. Example:

- "Show me why development costs are high this month"
- Result: ledger filter for Development expenses plus a cost breakdown chart

Do not invent numbers. Use seed data and derived metrics.

### Later-Phase Stubs

If included, People, Calendar, and Settings should be functional-looking but clearly secondary.

People:

- People costs by department
- Payroll as % of revenue
- Revenue per head

Calendar:

- Month view
- Upcoming obligations
- Payroll, retainers, invoices, renewals, tax, reviews
- Cash needed in next 30 days

Settings:

- Operating currency AED
- Reporting currency USD
- Fiscal year start
- Integration placeholders for Stripe, bank feed, accounting tool, Slack, email
- Note that Notion and Airtable are mirrors only, never operational DBs

## Copy and UX Tone

Use plain operational language.

Prefer:

- "Review 3 low-confidence rows"
- "Open source rows"
- "Apply category"
- "Undo edit"
- "Commit approved rows"
- "Cash needed in next 30 days"

Avoid:

- Marketing slogans
- Vague AI claims
- "Submit"
- Long explanatory paragraphs inside the app

## Acceptance Criteria

The frontend prototype is complete when:

- The app starts on a real Dashboard, not a landing page.
- Dashboard, Ledger, Departments, Category Settings, CSV Import Review, and AI Insights are navigable.
- The seed data from `PRD.md` is represented.
- The dashboard shows the five required KPI cards.
- Dashboard charts and department rollups exist.
- KPI and chart panels expose source row counts and drill down to ledger filters.
- Ledger filters are stackable, visible as chips, and reflected in URL state.
- Ledger totals and dashboard metrics are calculated from the same transaction data.
- Forms use React Hook Form and Zod.
- shadcn conventions are followed.
- The UI is responsive on desktop and mobile.
- No backend APIs are called.
- The codebase is organized for future Supabase, n8n, and Claude API integration.
- `pnpm lint` and `pnpm build` pass.

## Verification

After implementation:

1. Run formatting/linting:

```bash
pnpm lint
```

2. Run production build:

```bash
pnpm build
```

3. Start the dev server:

```bash
pnpm dev
```

4. Verify in browser:

- Dashboard loads and is not blank.
- Navigation works.
- Ledger filters update chips, totals, and URL.
- KPI/chart drill-down opens filtered ledger rows.
- Manual transaction form validates bad data.
- CSV import review shows confidence and human-in-loop behavior.
- Mobile layout has no overlapping text or controls.

## Final Response Format

When done, report:

- Main files/folders created or changed
- Any shadcn components added
- Verification commands and results
- Local dev URL
- Known prototype limitations

Keep the final response short and factual.
