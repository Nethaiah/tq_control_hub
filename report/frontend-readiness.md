# Frontend Readiness Report

## Status

The Techquarters Management Hub frontend-only MVP is complete and ready for backend implementation. The latest UI/UX cleanup pass replaced native prompts and cluttered inline forms with shadcn `Dialog` / `AlertDialog` surfaces, and all workspace routes continue to build successfully.

## PRD Alignment

| PRD Area | Frontend Status |
| --- | --- |
| **Ledger** | Implemented with required columns, stackable URL filters, removable filter chips, running totals, manual add sheet, search, inline editing with optimistic update + undo toast, bulk edit for department/category, and shareable filtered views. |
| **Dashboard** | Implemented with KPI cards (net profit, net margin %, MRR, cash runway, anomaly flags), required chart catalogue, global date range selector, and drill-down into exact ledger rows. |
| **Departments** | Implemented as mini-business cards with revenue, cost, contribution margin, headcount, budget vs actual, trend, and pre-filtered ledger links. |
| **People / Team** | Implemented with staff/contractor records, cost per department, payroll % revenue, revenue per head, and linked payroll rows. |
| **Calendar** | Implemented with month view, upcoming obligations list, cash needed in next 30 days, recurring item preview, idempotency keys, and ledger links. |
| **Category Settings** | Implemented with create/rename/archive for categories and subcategories, recurring item templates, categorization rules, and CSV mapping rules. All state is local prototype state. |
| **CSV Import** | Implemented as a frontend simulation: upload dropzone (`src/components/kibo-ui/dropzone`), delimiter/encoding/header summary, column mapping, validation, duplicate blocking, AI confidence scoring, staging review, human correction, simulated commit, audit status, and reversibility. |
| **AI Insights** | Implemented as frontend-only surfaces: automatic categorization, natural language query, monthly briefing, anomaly detection, forecasting, and OCR drafts. Confidence scores, review states, trace links, and projection/draft labels are visible. |
| **Settings / Integrations** | Implemented with AED/USD currency, fiscal year/timezone, integration placeholders (Stripe, bank, accounting, Slack, email), Notion/Airtable mirror-only boundary, n8n automation safety map, and owner/staff permission guard previews. |
| **Data Model + Decisions** | Documented in `DECISION_LOG.md` and `report/original-prd-frontend-countercheck.md`. Zod schemas, typed seed data, pure metrics functions, URL filter object, stored FX rates, and recurring idempotency keys are in place. |

## UI/UX Cleanup Summary

| Before | After |
| --- | --- |
| Native `window.prompt` for category/rule/template/mapping renames | `RenameDialog` shared component using shadcn `Dialog` |
| Direct archive/delete actions | `ConfirmDialog` shared component using shadcn `AlertDialog` |
| Inline ledger filter form taking full card width | `FiltersDialog` trigger button with full filter form inside a dialog; active chips stay visible |
| Inline dashboard date-range card | Compact `Date range` dialog trigger |
| Full-width explanatory alert banners on dashboard, AI insights, calendar, people | Help icon buttons that open `HelpDialog` with the same explanatory content |
| Ledger filter selects showing raw `"all"` value | `SelectFilter` now renders the proper `"All"` label via explicit trigger-span |
| Static dashed-box CSV upload mock | `Dropzone` from `src/components/kibo-ui/dropzone` with drag-and-drop, file type/size validation, and upload feedback |
| Native `<input type="date">` pickers | `DatePicker` component using `Calendar` with month/year dropdown selectors, `PPP` format display |

Two warning alerts remain inline by design because they communicate operational risk:

- Settings — "Operational database boundary" (`variant="destructive"`)
- CSV Import — "Duplicate upload blocked" (`variant="destructive"`)

## Key Frontend Architecture Decisions

### Tables: `@tanstack/react-table`

All feature tables use `@tanstack/react-table` rendered through a single reusable wrapper:

- `src/components/common/data-table.tsx`
- Sorting, pagination via `src/components/ui/pagination.tsx`, page-size control, global search, row selection, selected count, column visibility, reset controls, and optional bulk actions.
- Column alignment is driven by TanStack `ColumnMeta` so text/number columns line up consistently.
- Normal tables use full-width fixed layout; the Ledger opts into a `wide` scrollable mode because it has many editable columns.

Tables currently using this wrapper:

- Ledger transactions
- Category settings recurring templates
- CSV import staging rows
- CSV import committed rows
- People team records
- Calendar recurring preview
- Settings roles and permission guards

### Dialogs

Shared dialog components live in `src/components/common/`:

- `rename-dialog.tsx` — controlled text-edit dialog, replaces `window.prompt`.
- `confirm-dialog.tsx` — controlled `AlertDialog` for destructive/archive confirmations.
- `filters-dialog.tsx` — compact filter trigger with count badge and dialog form.
- `help-dialog.tsx` — info-icon trigger for explanatory/help content.

These wrap the existing shadcn/Base UI primitives in `src/components/ui/dialog.tsx` and `src/components/ui/alert-dialog.tsx`.

### State & Filtering

- `src/hooks/use-url-filters.ts` drives a single composable `TransactionFilters` object through Next.js URL search params.
- The same filter object powers the ledger, dashboard metrics, charts, people rollups, calendar rollups, and AI trace links.
- Exact source-row drill-down uses an `ids` URL filter so any derived number can land on the rows that produced it.

### Client vs Server Boundaries

- `app/(workspace)` route pages and layouts remain Server Components.
- Client components are isolated to interactive surfaces: tables, forms, filters, charts, calendar, and sidebar.

## What Is Simulated / Stubbed for Backend

The frontend is backend-ready but does not yet call any external service. The backend phase will replace:

- Mock repository functions in `src/data/mock-repository.ts` with Supabase queries or SQL views.
- Local React state mutations with server actions and persisted updates.
- Simulated CSV file handling with real file parsing, upload storage, and `csv_imports` audit records.
- Simulated AI suggestions with real Claude API calls (categorization, NL query, briefing, anomaly, forecasting, OCR).
- Simulated recurring generation and calendar population with idempotent n8n workflows.
- Integration placeholders (Stripe, bank feed, accounting tool, Slack, email) with real connections.
- Frontend-only permission previews with enforced Supabase RLS and role-based access.

## Verification

- `pnpm build` passes after the dialog cleanup.
- No remaining `window.prompt` calls in `src/`.
- Only two `<Alert>` instances remain in `src/features/`, both destructive warnings that should stay visible.

## Next Phase

Backend implementation can begin. The recommended order:

1. Supabase schema + seed data migration from `src/data/seed.ts` and `src/domain/schemas.ts`.
2. Server actions for ledger edits, category changes, CSV commits, and AI suggestion application.
3. SQL views / RPC functions for dashboard and department aggregations.
4. Supabase Auth + RLS for owner/staff permissions.
5. Real CSV upload/parsing and import audit storage.
6. n8n idempotent recurring generation and calendar population.
7. Claude API integration for AI features.
8. External integrations (Stripe, bank feed, accounting tool, Slack, email).
