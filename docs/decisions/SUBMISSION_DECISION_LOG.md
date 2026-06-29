# Submission Decision Log

## Current Position

This build is a production-shaped MVP of the Techquarters Management Hub. It includes the required workspace surfaces: Dashboard, Ledger, Departments, Category Settings, CSV Imports, AI Insights, People, Calendar, and Settings. The system now has a Supabase/Postgres data model through Drizzle, route-backed ledger/import/AI workflows, URL-shareable filters, audit logs, and owner/staff permission boundaries. The largest remaining gaps are full SQL aggregate optimization for every dashboard chart, live n8n automation, real external financial feeds, and deeper recurring proration handling.

## Key Decisions And Tradeoffs

| Area | What I Did | Why | Cost / Tradeoff |
| --- | --- | --- | --- |
| Data model | Used one `transactions` table with `type` for revenue and expense. | The PRD is a ledger-first system; one hot table makes filters, totals, audit, CSV commits, and drill-down consistent. | Type-specific validation has to be enforced in API/database checks instead of separate tables. |
| Database access | Used Supabase Postgres as the source of truth and Drizzle for schema, migrations, typed queries, and mutations. | Supabase gives Auth/RLS/realtime/storage fit; Drizzle keeps complex financial queries reviewable in TypeScript. | Some security policies and advanced SQL still live in migrations, so Drizzle is not the only schema surface. |
| Tables | Used TanStack Table behind `DataTable`. | Ledger/import/category/people/calendar tables need sorting, pagination, column visibility, row selection, and bulk actions without locking UI into a table vendor. | It adds table-state complexity and requires controlled server-side mode for large data. |
| Server state | Used TanStack Query for API reads/mutations, optimistic edits, rollback, and invalidation. | Inline ledger edits, CSV staging, commits, reversals, and AI review are server-state workflows, not local UI state. | Query keys and invalidation rules must be maintained carefully. |
| AI provider | Used OpenRouter instead of a direct Claude-only client. | OpenRouter lets the app route to cheaper/faster models during development while keeping the same financial safety boundary: AI proposes, humans commit. | This deviates from the PRD's named Claude API; if required, the provider can be swapped to Claude behind the same categorization/query functions. |
| Filtering | Built one composable filter object shared by ledger, metrics, charts, and drill-down URLs. | A number is only useful if the owner can click into the rows that produced it and share that exact view. | Every new chart must map back into the same filter vocabulary. |
| CSV imports | Parse messy headers/dates/amounts, hash files, detect duplicate files/rows, stage rows, require review, then commit. | The ledger must not be poisoned by bad CSV data or duplicate uploads. | More workflow states and staging tables than a simple upload-to-ledger path. |
| Multi-currency | Store original `currency` plus `fx_rate_to_usd` per transaction and recurring item. | USD reports stay historically stable when AED/USD rates move later. | FX is currently a stored/static rate path, not a full rate-provider integration. |
| Editability | Inline and bulk transaction edits write revision rows and audit logs. Categories are stable IDs with archive/rename instead of destructive delete. | Reclassification should be fast without losing the historical trail. | Full category versioning/snapshotted reporting is not implemented yet. |
| Permissions | Added organization membership, owner/staff roles, department access, API guards, and RLS policies. | Owner sees the full cockpit; staff should be department-scoped and blocked from money-impacting commits. | Staff UX is still basic and payroll visibility needs more testing. |

## PRD Hard Parts Status

| Hard Part | Status | Approach And Honest Gap |
| --- | --- | --- |
| Aggregation at scale | Partial | Ledger totals are server-side SQL with scoped filters and indexes. Dashboard metrics still reuse TypeScript metric builders after loading scoped rows, which is good for correctness now but should move to SQL views/materialized views for scale. |
| Stackable filters | Achieved | URL state drives ledger, totals, charts, chips, search, pagination, and drill-down links. |
| Recurring without double counting | Partial | Schema includes `recurring_items`, `recurring_runs`, and unique idempotency keys. Actual n8n generation and mid-month proration are not complete. |
| CSV reality | Achieved for MVP | Header aliases, date/amount/currency parsing, file hash duplicate blocking, row duplicate detection, staging review, confidence, commit, reverse, and audit are implemented. Encoding detection is recorded as UTF-8 rather than fully auto-detected. |
| Multi-currency | Partial | AED/USD are modeled and FX is stored per row. Live FX ingestion and rate audit history are not implemented. |
| AI with judgement | Achieved for five features | OpenRouter supports CSV categorization, natural-language filter translation, monthly briefing generation, and 12-month forecasting with confidence, fallbacks, and no direct ledger mutation. Briefing/forecast are on-demand POST routes triggered by UI buttons. OCR remains a contextual MVP note inside its card because no multimodal model is configured. | AI suggestion action buttons (Confirm/Apply, Dismiss) are hidden when `reviewState` is `applied` or `dismissed`. |
| Calendar / Automation | Partial | Schema includes `calendar_events` and `recurring_items` tables. Calendar view uses read-time projections from active recurring items (`planned:<id>` synthetic IDs) instead of real `calendar_events` inserts since the n8n automation runner is not built yet. | Real `calendar_events` rows win over planned projections when both exist. |
| Debounced filters | Added | `DataTable` now supports debounced server-side search. Ledger and recurring template filters use local draft state with a "Save filters" button to avoid excessive API calls on every keystroke. | Two-phase filter UX (draft vs applied) requires careful state sync. |
| CSV import review | Achieved for MVP | Import review grid supports server-side filter, sort, and paginate via `staged-rows` API. | Pattern matches the ledger data table for consistency. |
| MVP notes | Contextual only | MVP notes appear inside specific feature cards (OCR, categories, settings) rather than a global dashboard banner. | Keeps the dashboard clean while surfacing gaps where they matter. |
| Editability without breakage | Achieved for MVP | Stable category IDs, archive behavior, bulk edits, transaction revisions, and audit logs protect history. Full report snapshotting is future work. |
| Permissions | Partial | API guards and RLS cover owner/staff and department scope. Final staff-safe UI and payroll-specific test coverage remain. |

## What I Would Do Next

1. Move dashboard-wide MRR, margin, runway, department P&L, and chart rollups fully into SQL views or RPCs with `security_invoker` where exposed.
2. Implement n8n recurring generation using `recurring_runs.idempotency_key`, including missed-run replay, proration, and calendar event creation.
3. Add a proper FX-rate table/provider and store rate source/timestamp per transaction.
4. Finish staff UX and payroll-safe views, then run RLS smoke tests for owner, staff-with-department, and staff-without-department.
5. Add external syncs: Stripe, bank feed/accounting feed, Slack/email alerts, and Notion/Airtable mirror-only exports.
6. Add production tests around CSV duplicate handling, AI confidence gates, import reversal, and bulk category reassignment.
