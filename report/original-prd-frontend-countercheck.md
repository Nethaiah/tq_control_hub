# ORIGINAL_PRD Frontend Countercheck

## Status

The frontend MVP now covers the broad `ORIGINAL_PRD.md` product surface as a backend-ready prototype. A final audit was run against both `ORIGINAL_PRD.md` and `PRD.md` and the build is clean. Remaining work is backend persistence, real integrations, auth/RLS enforcement, and final UI/UX polish.

## Final Audit Summary

| Audit check | Result |
| --- | --- |
| `pnpm build` passes | Yes |
| No remaining `window.prompt` calls | Confirmed (`grep` returned no matches) |
| No remaining native `<input type="date">` | Confirmed (`grep` returned no matches) |
| All workspace routes have `loading.tsx` / `error.tsx` | Yes |
| All feature tables use `@tanstack/react-table` via `DataTable` | Yes |

## Covered In Frontend

| PRD area | Frontend status |
| --- | --- |
| Owner cockpit and nine decision questions | Covered by dashboard KPIs, chart catalogue, runway, growth efficiency, concentration, people, calendar, and anomaly surfaces. |
| Ledger source of truth | Covered with required columns, stackable URL filters, chips, running totals, manual add, search, row selection, bulk edit, and inline edit across required cells. |
| Dashboard catalogue | Covered with KPI cards, revenue/expense trend, MRR movement, revenue by department, expense breakdown, margin trend, department P&L, revenue split, top clients, cash runway, budget vs actual, and global date range controls. |
| Departments | Covered with mini-business cards, revenue, cost, contribution margin, headcount, budget use, trend, and filtered ledger links. |
| People / Team | Covered with staff/contractor records, cost by department, payroll % revenue, revenue per head, and exact linked payroll rows where posted. |
| Calendar | Covered with month view, upcoming obligations, payroll/retainer/invoice/renewal/tax/review events, cash needed, recurring preview, idempotency keys, and ledger links. |
| Category settings | Covered with category/subcategory create, rename, archive, recurring templates, categorization rules, and CSV mapping rules in local state. |
| CSV pipeline | Covered with upload dropzone (`src/components/kibo-ui/dropzone`), delimiter/encoding/header summary, mapping, validation, duplicate block, AI confidence, staging review, human correction, simulated commit, audit status, and reversal. |
| AI layer | Covered with categorization, natural-language query, monthly briefing, anomaly, forecasting, and OCR draft surfaces. Confidence, traceability, and human confirmation are visible. |
| Automation layer | Covered as frontend runbook/safety map for n8n recurring generation, calendar population, external sync, alerts, and scheduled reporting. |
| Settings/integrations | Covered with AED/USD, fiscal year/timezone, Stripe/bank/accounting/Slack/email placeholders, Notion/Airtable mirror-only boundary, and permission previews. |
| Data model and decisions | Covered by Zod schemas, typed seed data, pure metrics functions, URL filter object, stored FX rates, recurring idempotency keys, and `DECISION_LOG.md`. |

## PRD Requirement Detail Check

### Dashboard (§4.2 / §7)
- **KPI cards:** Net profit, net margin %, MRR, cash runway, anomaly flags — each shows value, change label, and direction badge.
- **Charts:** Revenue vs expenses combo, MRR trend with movement, revenue by department, expense breakdown donut, profit margin trend line, department P&L table, revenue type split donut, top clients horizontal bar with concentration callout, cash runway panel, budget vs actual grouped bar.
- **Global date range:** `DateRangeControls` now uses `DatePicker` with month/year dropdown.
- **Drill-down:** Every KPI, chart, people cost, calendar event, and AI claim links to `/ledger` with matching filters or `ids`.

### Ledger (§4.1 / §5.1)
- **Columns:** date, type, description, amount, currency, department, category, subcategory, client/vendor, recurring, source, attachment — all present and inline editable.
- **Filters:** department, category, type, date range, client/vendor, source, search — stackable, URL-driven, visible as removable chips.
- **Inline edit:** optimistic update with toast undo for single-cell edits; bulk edit for department/category with undo.
- **Add entry:** manual revenue/expense sheet.
- **Running totals:** summary cards reflect active filter set.

### Departments (§4.3 / §5.3)
- Cards show revenue, cost, contribution margin, headcount, budget vs actual, trend.
- Each card links to a pre-filtered ledger view.

### People (§4.4 / §5.4)
- Team records table with name, department, role, type, cost, start date, status.
- Rollups: cost per department, payroll % revenue, revenue per head.
- Linked payroll rows flow into the same ledger-backed P&L.

### Calendar (§4.5 / §5.5)
- Month view via Kibo calendar, upcoming obligations list.
- Event types: payroll, retainer, invoice_due, renewal, tax, review.
- Cash needed in next 30 days surfaced.
- Recurring preview table with idempotency keys.

### Category Settings (§4.6 / §5.6)
- Create/rename/archive revenue and expense categories/subcategories via dialogs.
- Recurring item templates table.
- Categorization rules and CSV mapping rules editable via dialogs.

### CSV Import (§8 / §8)
- Dropzone upload, column mapping form, validation, duplicate detection, AI confidence, staging review table, human confirmation gating, simulated commit, audit/reversibility.

### AI (§9 / §9)
- Automatic categorization with confidence badges and confirm/dismiss.
- Natural language query converted into existing filters.
- Monthly briefing, anomaly, forecasting, and OCR draft surfaces with trace links and projection/draft labels.

### Settings (§4.8 / §5.8)
- Operating/reporting currency, fiscal year start, timezone.
- Integration placeholders and mirror-only Notion/Airtable warning.
- n8n automation safety map.
- Roles/permissions tables and owner/staff guard previews.

### Data Model (§5 / §6)
- Zod schemas define: transactions, departments, categories, clients, people, recurring_items, calendar_events, csv_imports, app_settings, integrations, permission_roles, ai_suggestions.
- Decisions documented in `DECISION_LOG.md`:
  - One `transactions` table with `type` field.
  - `currency` + `fxRateToUsd` stored per transaction for stable USD reporting.
  - Categories as data with `parentId`; historical rows keep stable IDs.
  - Recurring items use `idempotencyKey` to prevent double posting.
  - CSV rows staged separately before commit.

## Backend-Only Remaining

- Supabase Postgres schema, SQL views, RLS, auth, realtime, and server actions.
- Durable ledger/category/import mutation persistence.
- Real CSV parsing, uploaded files, attachments, and import audit storage.
- Real Claude API, OCR, forecasting model, and monthly briefing generation.
- Real n8n workflows, Stripe, bank feed, accounting sync, Slack/email delivery.
- Enforced permissions rather than frontend preview guards.

## Verification

- `pnpm build` passed after final audit.
- Lint/Biome was intentionally not run, matching the previous user instruction to skip lint checks.

