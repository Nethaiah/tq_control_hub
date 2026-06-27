# Techquarters Management Hub Decision Log

## Prototype Scope

Built a frontend-only MVP prototype for the owner cockpit: Dashboard, Ledger, Departments, Category Settings, CSV Import Review, AI Insights, People, Calendar, and Settings. The latest pass closes the broad `ORIGINAL_PRD.md` frontend gaps before backend and final UI/UX work.

## Data Model Choices

- Revenue and expenses use one `transactions` model with `type: "revenue" | "expense"` so ledger filters, audit trails, and dashboard rollups share one source of truth.
- Each transaction stores `currency` and `fxRateToUsd` so historical USD reporting is stable even when AED exchange rates change later.
- Categories and subcategories are stored as data with `parentId`, not hardcoded UI constants. Historical rows keep stable category IDs even when names change.
- Recurring templates include an `idempotencyKey`. Future automation should generate one transaction per recurrence window and reject replayed keys.
- CSV rows are staged separately from committed ledger transactions. Validation, duplicate detection, AI suggestions, and human review happen before commit.

## Aggregation and Filtering

- A single composable filter object drives ledger rows, dashboard metrics, totals, charts, and drill-down links.
- Prototype aggregations are pure TypeScript functions in `src/domain/metrics.ts`; these are shaped to move behind SQL views or server queries later.
- Every KPI and chart panel exposes a ledger row count and links to `/ledger` with the matching filter query.
- Exact source-row drill-down is represented with an `ids` URL filter, so KPI, chart, people, calendar, and AI links can land on the rows that produced a number.
- The dashboard now has an explicit global date range control, cash runway panel, and growth-efficiency panel for CAC, LTV, LTV:CAC, and payback assumptions.

## AI Boundaries

- MVP AI features are automatic categorization and natural language query because they directly support CSV review, ledger filtering, and dashboard drill-downs.
- AI suggestions carry confidence scores and review state. Low-confidence or money-impacting changes require human confirmation.
- AI query results use existing mock ledger rows and derived metrics only. No external API is called and no numbers are invented.
- Monthly briefing, anomaly, forecasting, and OCR are also represented as frontend-only draft/review surfaces with trace links and projection/draft labels.

## Frontend Architecture

### Tables

- All feature tables use `@tanstack/react-table` rendered through a single reusable wrapper: `src/components/common/data-table.tsx`.
- The wrapper provides sorting, pagination via `src/components/ui/pagination.tsx`, page-size control, global search, row selection, selected count, column visibility, reset controls, and optional bulk actions.
- Column alignment is driven by TanStack `ColumnMeta` so text/number columns stay consistent.
- Normal tables use full-width fixed layout; the Ledger opts into a `wide` scrollable mode because it has many editable columns.
- Tables using the wrapper: Ledger transactions, category recurring templates, CSV import staging/committed rows, people team records, calendar recurring preview, and settings roles/permission guards.

### Dialogs and Form Cleanup

- Reusable dialog components live in `src/components/common/`: `rename-dialog.tsx`, `confirm-dialog.tsx`, `filters-dialog.tsx`, and `help-dialog.tsx`.
- These wrap the existing shadcn/Base UI `Dialog` and `AlertDialog` primitives so the UI stays consistent without cluttering individual feature files.
- Native `window.prompt` was removed entirely; text edits now use `RenameDialog`.
- Destructive/archive actions now use `ConfirmDialog` (AlertDialog) instead of immediate deletion.
- The ledger filter form was moved into `FiltersDialog`; active filter chips remain visible.
- Dashboard date controls were compacted into a `Date range` dialog trigger.
- Explanatory alert banners on dashboard, AI insights, calendar, and people were converted to `HelpDialog` info-icon triggers.
- Destructive warning alerts (settings operational boundary, CSV duplicate upload) remain inline because they communicate operational risk.
- Ledger filter `SelectFilter` now renders the proper `"All"` label by replacing `SelectValue` with an explicit trigger-span, avoiding both the raw `"all"` value fallback and duplicated label rendering seen in Base UI selects.
- CSV upload uses `Dropzone` from `src/components/kibo-ui/dropzone` with drag-and-drop, `.csv` file validation, size limits, and toast feedback. File parsing remains mocked for the frontend prototype.
- All native `<input type="date">` pickers replaced with `DatePicker` component (`src/components/common/date-picker.tsx`) using `Calendar` with `captionLayout="dropdown"` and month/year selectors. Displays dates in `PPP` format (e.g., "Jun 15, 2026") and accepts/returns `YYYY-MM-DD` strings for compatibility with existing filter state.

### Client/Server Boundaries

- `app/(workspace)` route pages and layouts remain Server Components.
- Client components are isolated to interactive surfaces: tables, forms, filters, charts, calendar, and sidebar.

## Frontend Coverage Added After Audit

- Ledger now exposes a dedicated client/vendor filter and inline editing for date, type, description, amount, currency, department, category, subcategory, client/vendor, recurring flag, source, and attachment.
- Category settings now lets the owner create, rename, and archive parent categories and subcategories, plus define categorization rules, recurring templates, and CSV mapping rules in local prototype state.
- CSV import now simulates a safe commit path: low-confidence and blocked rows require human correction, duplicate rows are excluded, committed rows are visible, and the import can be reversed from its audit panel. The upload surface uses the kibo-ui `Dropzone` component.
- Settings now includes an n8n automation safety map for recurring generation, calendar population, external sync, risk alerts, and scheduled reporting, plus owner/staff permission guard previews.
- UI/UX cleanup replaced native prompts and cluttered inline forms with shadcn `Dialog` / `AlertDialog` surfaces. It also fixed the ledger filter select labels and replaced the CSV upload mock with a real dropzone. See the "Frontend Architecture" section above for details.

## Skipped Backend Work

- Supabase schema, RLS, realtime, server actions, n8n automation, Claude API calls, Stripe, bank feeds, OCR, and deployment are intentionally not implemented in this frontend prototype.
- Supabase RLS/permissions, n8n runs, external sync, AI API calls, and CSV persistence are intentionally simulated in the frontend until backend implementation.

## Readiness Statement

The frontend-only MVP is complete enough to proceed to backend implementation against `ORIGINAL_PRD.md` and `PRD.md`. All required tabs and capabilities are represented in the UI, mock data drives the owner cockpit, and `pnpm build` passes. A final countercheck confirmed no native date inputs or `window.prompt` calls remain, all feature tables use `@tanstack/react-table`, and every PRD surface is covered at the frontend level. See `report/original-prd-frontend-countercheck.md` for the full audit.

## Next Steps

1. Migrate `src/data/seed.ts` and `src/domain/schemas.ts` into a Supabase Postgres schema.
2. Replace `src/data/mock-repository.ts` functions with Supabase queries or SQL views.
3. Add server actions for ledger edits, CSV commits, category changes, and AI suggestion application.
4. Implement Supabase Auth + RLS for owner versus staff views.
5. Replace simulated CSV handling with real file parsing, upload storage, and `csv_imports` audit records.
6. Implement idempotent recurring generation and calendar population through n8n.
7. Integrate Claude API for automatic categorization, natural language query, briefing, anomaly detection, forecasting, and OCR.
8. Wire up external integrations: Stripe, bank feed, accounting tool, Slack, and email.
