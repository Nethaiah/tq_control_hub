# Backend Implementation Plan

## Purpose

This document maps the backend work required by `ORIGINAL_PRD.md` and `PRD.md` into an executable implementation roadmap. The frontend prototype is complete and verified in `report/original-prd-frontend-countercheck.md`; this plan starts the backend phase from that stable frontend surface.

The backend goal is to turn the frontend prototype into the operational system of record: durable data, authenticated users, owner/staff permissions, server-side aggregation, safe CSV imports, AI draft workflows, recurring automation, and integration-ready APIs.

## Source Documents

- `ORIGINAL_PRD.md` — strict source of product requirements.
- `PRD.md` — MVP plan, phase order, and acceptance checklist.
- `DECISION_LOG.md` — frontend prototype decisions and current mock architecture.
- `report/original-prd-frontend-countercheck.md` — final frontend coverage audit.
- `report/frontend-readiness.md` — readiness summary before backend.

## Chosen Backend Stack

| Layer | Tool | Responsibility |
| --- | --- | --- |
| Database | Supabase Postgres | Operational system of record, RLS, triggers, realtime, storage metadata |
| ORM | Drizzle ORM | Typed schema, migrations, database queries, server-side aggregation queries |
| Driver | `postgres` | Direct connection to Supabase Postgres pooler with `prepare: false` |
| Auth/session | `@supabase/ssr` | Next.js App Router auth sessions, cookie refresh, server/browser clients |
| Realtime/storage | `@supabase/supabase-js` | Realtime channels, file uploads, CSV/receipt storage |
| API boundary | Next.js `app/api/*` route handlers | HTTP contract for frontend, n8n, and future external clients |
| Client cache | TanStack Query | Query cache, mutations, optimistic updates, invalidation, retry behavior |
| Automation | n8n | Recurring generation, external sync, alerts, scheduled reporting |
| AI | Claude API | Categorization, natural language query, briefing, anomaly, forecasting, OCR |
| Later optimization | Next.js Cache Components | Cache static shells and expensive aggregate reads after backend stabilizes |

## Why This Stack

### Supabase Postgres

`ORIGINAL_PRD.md` specifies Supabase as the expected database. Supabase gives us Postgres, Auth, RLS, Storage, Realtime, and a clear path to n8n integrations.

### Drizzle ORM

The product needs complex server-side aggregates: MRR movement, department P&L, cash runway, budget vs actual, payroll ratios, top client concentration, CSV validation counts, and anomaly checks. Drizzle gives type-safe SQL composition and migrations while keeping the database as plain Postgres.

### Supabase SSR and Supabase JS

Drizzle does not handle auth, realtime, or storage. We still need Supabase clients for:

- Server auth sessions and cookie refresh with `@supabase/ssr`.
- Browser realtime channels with `@supabase/supabase-js`.
- Storage uploads for CSV files, attachments, receipts, and OCR source files.

Data queries should use Drizzle, not Supabase query builder, unless a feature specifically needs Supabase Realtime or Storage APIs.

### Next.js API Routes

API routes fit TanStack Query naturally and create a durable contract for future integrations. They also let n8n call the same backend surface as the frontend.

### TanStack Query

The frontend prototype already uses local optimistic updates and mutation state. TanStack Query will replace that local state with cached queries, optimistic mutations, rollback, and invalidation.

## High-Level Architecture

```text
Client Components
  use TanStack Query for reads/mutations
        |
        v
Next.js API Routes in app/api/*
  validate input, check auth/permissions, call repositories
        |
        v
Repository Layer
  Drizzle typed queries and transactions
        |
        v
Supabase Postgres
  tables, indexes, RLS, views, triggers, realtime

Side channels:
  @supabase/ssr         -> auth sessions and cookie refresh
  @supabase/supabase-js -> realtime and storage
  n8n                  -> calls protected webhook routes
  Claude API           -> called only from server routes
```

## Backend Requirements Map

| PRD requirement | Backend implementation |
| --- | --- |
| One ledger source of truth | `transactions` table with `type = revenue | expense` |
| Required ledger columns | Columns for date, type, description, amount, currency, fx rate, department, category, subcategory, client/vendor, recurring, recurrence, source, attachment, created_by |
| Stackable filters | `/api/transactions` accepts the same filter object used by frontend URL params |
| Shareable filter state | Frontend URL remains source of view state; API accepts filter params |
| Server-side rollups | Drizzle queries and/or `security_invoker` SQL views for dashboard, departments, people, calendar |
| Every derived number traces to rows | Aggregate endpoints return `transactionIds` or drill-down filter payloads |
| Inline optimistic edits | `PATCH /api/transactions/:id` with audit revision and TanStack optimistic update |
| Bulk edit | `PATCH /api/transactions/bulk` with transaction-safe updates and audit log |
| Manual entry | `POST /api/transactions` |
| CSV upload | Storage upload, `csv_imports`, `csv_staged_rows`, validation, human review, commit |
| Duplicate prevention | File hash, row hash, unique constraints, idempotency checks |
| AI categorization | Claude suggestions stored in `ai_suggestions`, never committed silently |
| Natural language query | Claude converts question into validated filter object and aggregate query |
| Monthly briefing | Draft generated from real aggregates and stored as reviewable AI suggestion |
| Forecasting | Projection stored with assumptions and traceable source rows |
| OCR | File upload creates draft transaction only; human confirms before commit |
| Calendar | `calendar_events` linked to transactions or recurring items |
| Recurring automation | `recurring_items`, `recurring_runs`, idempotency keys, n8n webhook |
| External sync | Stripe/bank/accounting rows enter staging, never commit directly |
| Alerts | Slack/email notifications from n8n, no direct ledger mutation |
| Permissions | Supabase Auth, `organization_members`, RLS, API guards, owner/staff scopes |
| Notion/Airtable mirrors | Read-only mirror destinations, never operational source |

## Directory Structure To Add

```text
src/
  app/
    api/
      me/route.ts
      transactions/route.ts
      transactions/[id]/route.ts
      transactions/bulk/route.ts
      categories/route.ts
      categories/[id]/route.ts
      recurring-items/route.ts
      recurring-items/[id]/route.ts
      imports/route.ts
      imports/[id]/staged-rows/route.ts
      imports/[id]/staged-rows/[rowId]/route.ts
      imports/[id]/commit/route.ts
      imports/[id]/reverse/route.ts
      metrics/dashboard/route.ts
      metrics/departments/route.ts
      metrics/people/route.ts
      metrics/calendar/route.ts
      ai/categorize/route.ts
      ai/query/route.ts
      ai/briefing/route.ts
      webhooks/n8n/recurring/route.ts
      webhooks/n8n/external-sync/route.ts
      webhooks/n8n/alerts/route.ts
  lib/
    db/
      index.ts
      schema.ts
      relations.ts
      queries/
        transactions.ts
        metrics.ts
        categories.ts
        imports.ts
        people.ts
        calendar.ts
        ai.ts
      mutations/
        transactions.ts
        categories.ts
        imports.ts
        ai.ts
    api/
      auth.ts
      errors.ts
      filters.ts
      permissions.ts
      responses.ts
      validation.ts
    supabase/
      client.ts
      server.ts
      middleware.ts
  providers/
    query-client-provider.tsx
drizzle/
  schema.ts
  migrations/
drizzle.config.ts
proxy.ts
BACKEND_DECISION_LOG.md
```

Notes:

- `src/lib/db/schema.ts` can re-export from `drizzle/schema.ts` or vice versa. Pick one source of truth before coding. I choose the `src/lib/db/schema.ts`.
- Route handlers should not contain long SQL. Keep queries in `src/lib/db/queries/*` and mutations in `src/lib/db/mutations/*`.
- API routes validate input with Zod before calling Drizzle.

## Environment Variables

Required local variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://bnqbldmvsbwulqrqlccy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_HdtC_6vtIUmsl6gBaQRYpA_fJuDxs8e
DATABASE_URL=postgresql://postgres.bnqbldmvsbwulqrqlccy:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
ANTHROPIC_API_KEY=
N8N_WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

Security notes:

- `NEXT_PUBLIC_*` values are browser-visible.
- `DATABASE_URL`, `ANTHROPIC_API_KEY`, `N8N_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` are server-only.
- Never expose the service role key in client code.
- Use the transaction-mode Supabase pooler with `postgres(connectionString, { prepare: false })`.

## Supabase Client Files

We still create Supabase client helpers even though Drizzle handles data queries.

| File | Purpose |
| --- | --- |
| `src/lib/supabase/server.ts` | Server auth/session client for route handlers and server components |
| `src/lib/supabase/client.ts` | Browser client for realtime subscriptions and storage UI |
| `src/lib/supabase/middleware.ts` | Session refresh helper used by root `middleware.ts` |
| `middleware.ts` | Calls Supabase middleware helper to keep auth cookies fresh |

Do not use Supabase query builder for core CRUD unless a feature specifically requires Supabase API behavior. Use Drizzle for ledger/category/import/metrics queries.

## Drizzle Setup

Required setup files:

| File | Purpose |
| --- | --- |
| `drizzle.config.ts` | Drizzle Kit config using `DATABASE_URL` |
| `drizzle/schema.ts` | Postgres table definitions |
| `src/lib/db/index.ts` | `postgres` client and `drizzle(client)` export |
| `src/lib/db/relations.ts` | Optional Drizzle relations for readable joins |

Connection pattern:

```ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

const connectionString = process.env.DATABASE_URL
const client = postgres(connectionString!, { prepare: false })

export const db = drizzle(client)
```

## Data Model Plan

### Multi-tenant base

Even if the first deployment is only Techquarters, add an organization boundary now. It makes RLS and future multi-company use predictable.

| Table | Key fields |
| --- | --- |
| `organizations` | `id`, `name`, `slug`, `created_at` |
| `profiles` | `id` = auth user id, `full_name`, `email`, `created_at` |
| `organization_members` | `id`, `organization_id`, `user_id`, `role`, `status` |
| `member_department_access` | `member_id`, `department_id` |

### Core PRD tables

| Table | Backend notes |
| --- | --- |
| `departments` | `organization_id`, name, color, monthly budget, active flag |
| `categories` | `organization_id`, name, kind, parent_id, archived flag |
| `clients` | `organization_id`, name, status, start date, mrr |
| `people` | `organization_id`, department_id, role, type, cost, cadence, status, payroll sensitivity |
| `transactions` | Ledger source of truth with all PRD columns and `organization_id` |
| `recurring_items` | Templates for recurring revenue/expense |
| `calendar_events` | Events linked to transaction or recurring item |
| `csv_imports` | Upload audit record, file hash, status, mapping |
| `csv_staged_rows` | Review rows before ledger commit |

### Backend support tables

| Table | Purpose |
| --- | --- |
| `transaction_revisions` | Undo/audit history for inline edits and bulk edits |
| `audit_logs` | Durable trail for ledger/category/import/AI/automation actions |
| `csv_mapping_rules` | Saved mappings per file shape |
| `ai_suggestions` | AI proposals, confidence, review state, source row IDs |
| `recurring_runs` | Idempotency record for recurring automation |
| `automation_runs` | n8n run audit, replay protection, status |
| `integration_connections` | Stripe, bank, accounting, Slack, email connection metadata |
| `notification_destinations` | Slack channels, email recipients, alert preferences |
| `department_budgets` | Period-specific budget values instead of one static budget |

## Permission Model

`ORIGINAL_PRD.md` calls out owner view vs staff view but does not define the full model. The backend should define it explicitly.

### Roles

| Role | Intent |
| --- | --- |
| `owner` | Full access and final authority for money-impacting changes |
| `staff` | Department-scoped access, can prepare drafts, cannot commit financial changes |

Future optional roles:

- `admin` for non-owner operational admin.
- `finance` for accountant/reviewer access.
- `viewer` for read-only investors/advisors.

Keep MVP to `owner` and `staff` unless a real need appears.

### Owner capabilities

- View all dashboard metrics, departments, people costs, and payroll details.
- View all ledger rows in the organization.
- Add, edit, and bulk edit transactions.
- Commit and reverse CSV imports.
- Manage categories, subcategories, recurring templates, and mapping rules.
- Apply or dismiss AI suggestions.
- Manage settings, integrations, notification destinations, and automation policies.
- Trigger or approve n8n outputs that affect the ledger.

### Staff capabilities

- View only assigned department rows.
- Use filters/search within assigned department scope.
- Prepare CSV staging rows but cannot commit to ledger.
- Draft or review AI suggestions but cannot apply money-impacting changes.
- View non-sensitive people records in assigned departments.
- No payroll cost details unless explicitly granted later.
- No category archive/delete.
- No integration/settings management.
- No recurring generation commit.

### RLS strategy

- Every business table includes `organization_id`.
- Department-scoped tables include `department_id` where relevant.
- RLS checks membership through `organization_members`.
- Owner policies allow all rows in their organization.
- Staff policies restrict rows to `member_department_access`.
- Payroll-sensitive data is either hidden by policy or exposed through staff-safe views.
- API routes perform explicit permission checks, but RLS remains the final guard.
- Authorization data should live in tables or `app_metadata`, never `user_metadata`.

### RLS implementation principles

- Enable RLS on all exposed tables.
- Use `TO authenticated` plus ownership predicates, not `auth.role()`.
- For `UPDATE`, define both `USING` and `WITH CHECK`.
- Views exposed to authenticated users should use `security_invoker = true` on Postgres 15+.
- Avoid `SECURITY DEFINER` unless absolutely necessary and never in exposed schemas without strict checks.

## API Route Plan

### Auth and context

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/me` | GET | Current user, org membership, role, department access |

### Transactions

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/transactions` | GET | List ledger rows with stackable filters |
| `/api/transactions` | POST | Manual transaction add |
| `/api/transactions/[id]` | PATCH | Inline edit one row |
| `/api/transactions/bulk` | PATCH | Bulk department/category update |

### Metrics

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/metrics/dashboard` | GET | Dashboard KPIs and chart data |
| `/api/metrics/departments` | GET | Department rollups |
| `/api/metrics/people` | GET | People cost metrics |
| `/api/metrics/calendar` | GET | Calendar rollups and events |

### Categories and recurring templates

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/categories` | GET | Category tree |
| `/api/categories` | POST | Create category/subcategory |
| `/api/categories/[id]` | PATCH | Rename/archive category |
| `/api/recurring-items` | GET | Recurring templates |
| `/api/recurring-items` | POST | Create template |
| `/api/recurring-items/[id]` | PATCH | Edit/archive template |

### CSV imports

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/imports` | POST | Upload CSV, hash file, parse, create staging rows |
| `/api/imports/[id]/staged-rows` | GET | Read staging rows |
| `/api/imports/[id]/staged-rows/[rowId]` | PATCH | Correct/approve/block staged row |
| `/api/imports/[id]/commit` | POST | Commit approved non-duplicate rows in one DB transaction |
| `/api/imports/[id]/reverse` | POST | Reverse committed import through audit trail |

### AI

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/ai/categorize` | POST | Suggest category/subcategory/department |
| `/api/ai/query` | POST | Convert natural language question to validated filters |
| `/api/ai/briefing` | POST | Generate monthly briefing draft |
| `/api/ai/forecast` | POST | Generate projection with assumptions |
| `/api/ai/ocr` | POST | Generate draft transaction from receipt/invoice |

### n8n webhooks

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/webhooks/n8n/recurring` | POST | Idempotent recurring generation |
| `/api/webhooks/n8n/external-sync` | POST | Stripe/bank/accounting sync into staging |
| `/api/webhooks/n8n/alerts` | POST | Run risk checks and notify Slack/email |
| `/api/webhooks/n8n/reporting` | POST | Scheduled monthly briefing generation |

Webhook routes must validate `N8N_WEBHOOK_SECRET` before doing anything.

## API Response Shape

Use a consistent envelope:

```ts
type ApiSuccess<T> = {
  ok: true
  data: T
}

type ApiFailure = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}
```

Recommended HTTP status usage:

| Status | Use |
| --- | --- |
| 200 | Successful read/update |
| 201 | Successful create |
| 400 | Invalid input |
| 401 | No valid session |
| 403 | Authenticated but not allowed |
| 404 | Missing row or hidden by permission |
| 409 | Duplicate/import/idempotency conflict |
| 422 | Valid request, invalid business rule |
| 500 | Unexpected server failure |

## TanStack Query Plan

### Provider

Add a `QueryClientProvider` client boundary under the root app shell. Keep route pages as Server Components.

### Query key conventions

| Data | Query key |
| --- | --- |
| Current user | `["me"]` |
| Ledger rows | `["transactions", filters]` |
| Dashboard metrics | `["metrics", "dashboard", filters]` |
| Department metrics | `["metrics", "departments", filters]` |
| People metrics | `["metrics", "people", filters]` |
| Calendar metrics | `["metrics", "calendar", filters]` |
| Categories | `["categories"]` |
| Recurring items | `["recurring-items"]` |
| Import staged rows | `["imports", importId, "staged-rows"]` |
| AI suggestions | `["ai-suggestions", filters]` |

### Mutation strategy

- Ledger inline edit: optimistic update, rollback on error, invalidate transaction and affected metric keys.
- Bulk edit: optimistic update selected rows, rollback on error, invalidate metrics.
- Category changes: invalidate categories, transactions, and metrics.
- CSV commit/reverse: invalidate imports, transactions, dashboard, departments, people, calendar.
- AI apply/dismiss: invalidate AI suggestions and affected rows/metrics.

### Realtime strategy

Use Supabase realtime only as an invalidation signal:

```text
transaction INSERT/UPDATE/DELETE -> invalidate ["transactions"] and ["metrics"]
category UPDATE -> invalidate ["categories"] and ["metrics"]
csv_import UPDATE -> invalidate ["imports"]
```

Do not try to manually merge every realtime payload into complex cached aggregates. Invalidate and refetch.

## CSV Import Backend Design

### Upload flow

1. Frontend uploads CSV to Supabase Storage or posts file to `/api/imports`.
2. Backend computes file hash.
3. If file hash already exists, create/return blocked duplicate state.
4. Backend detects delimiter, encoding, and header row.
5. Backend maps known columns using `csv_mapping_rules`.
6. Backend creates `csv_imports` row.
7. Backend creates `csv_staged_rows` rows.
8. Staging review UI loads rows through TanStack Query.

### Validation flow

Validation should identify:

- Bad date.
- Missing or invalid amount.
- Unsupported currency.
- Duplicate row hash.
- Missing category/department suggestion.
- Low AI confidence.

### Commit flow

Commit must run in one DB transaction:

1. Re-read staged rows with lock.
2. Reject if blocked/low-confidence rows remain.
3. Insert approved rows into `transactions`.
4. Mark staged rows as committed.
5. Mark import as committed.
6. Add audit log entries.

### Reverse flow

Reversal should not silently delete history. Preferred approach:

- Mark transactions as reversed or create reversal audit entries.
- Keep `csv_imports` history.
- Remove rows from active ledger views by status if necessary.

For MVP, hard delete can be avoided; use `status = reversed` where possible.

## AI Backend Design

### Guardrails

- AI never writes directly to `transactions`.
- AI writes to `ai_suggestions` with confidence, source row IDs, proposed action, assumptions, and review state.
- Owner applies/dismisses suggestions.
- Staff can prepare suggestions but cannot apply money-impacting actions.
- Natural language query can only output validated filter objects or approved aggregate types.

### AI features by endpoint

| Feature | Endpoint | Output |
| --- | --- | --- |
| Categorization | `/api/ai/categorize` | Suggested department/category/subcategory + confidence |
| Natural language query | `/api/ai/query` | Validated filters and traceable aggregate result |
| Monthly briefing | `/api/ai/briefing` | Draft briefing with source metric references |
| Anomaly detection | `/api/ai/anomaly` or metrics endpoint | Flags with source row IDs |
| Forecasting | `/api/ai/forecast` | Projection plus assumptions |
| OCR | `/api/ai/ocr` | Draft transaction from file |

## Recurring and n8n Automation Design

### Idempotency key format

Use a stable key per item and period:

```text
recurring_item_id + period_start + period_end + type
```

Store in `recurring_runs.idempotency_key` with a unique constraint.

### Recurring run flow

1. n8n calls `/api/webhooks/n8n/recurring` with secret.
2. Backend finds due recurring items.
3. Backend computes idempotency key per item/period.
4. If key exists, skip.
5. Create draft transaction or staged automation row.
6. Create/update calendar event.
7. Add audit log.
8. Owner reviews before commit if money-impacting.

### External sync flow

- Stripe revenue, bank expenses, and accounting rows must enter staging.
- They reuse CSV validation, categorization, duplicate detection, and human review.
- No external integration commits directly to `transactions`.

## Index and Performance Plan

Initial indexes:

- `transactions(organization_id, date)`
- `transactions(organization_id, type, date)`
- `transactions(organization_id, department_id, date)`
- `transactions(organization_id, category_id, date)`
- `transactions(organization_id, client_id, date)`
- `transactions(organization_id, source, date)`
- `transactions(organization_id, recurring, date)`
- `categories(organization_id, parent_id)`
- `people(organization_id, department_id, status)`
- `calendar_events(organization_id, date)`
- `csv_imports(organization_id, file_hash)` unique where appropriate
- `csv_staged_rows(import_id, review_state)`
- `recurring_runs(organization_id, idempotency_key)` unique
- `organization_members(user_id, organization_id)`
- `member_department_access(member_id, department_id)`

Use partial indexes later for common filters, such as active transactions or unreversed imports.

## Phase Roadmap

### Phase 0: Backend Foundation

Deliverables:

- Confirm/install packages: `@supabase/supabase-js`, `@supabase/ssr`, `drizzle-orm`, `drizzle-kit`, `postgres`, `@tanstack/react-query`, `@tanstack/react-query-devtools`.
- Add env variables.
- Add Supabase server/browser/middleware helpers.
- Add root middleware for session refresh.
- Add Drizzle config and DB client.
- Add TanStack Query provider.
- Add API response/error helpers.

Acceptance criteria:

- `pnpm build` passes.
- `/api/me` can return unauthenticated state safely.
- DB connection can run a test query server-side.

### Phase 1: Schema and Seed

Deliverables:

- Drizzle schema for core tables.
- Initial migration.
- Seed organization, owner profile, departments, categories, clients, people, transactions, recurring items, calendar events.
- Basic indexes.

Acceptance criteria:

- Seeded data matches frontend mock story.
- Required PRD entities exist in database.
- Drizzle queries can fetch ledger rows and category tree.

### Phase 2: Auth and Permissions

Deliverables:

- Supabase Auth setup.
- `profiles`, `organization_members`, `member_department_access`.
- RLS policies for owner and staff.
- API permission helpers.
- Staff-safe payroll/people access rules.

Acceptance criteria:

- Owner sees all organization data.
- Staff sees only assigned departments.
- Staff cannot commit CSV imports, apply AI suggestions, edit settings, or view restricted payroll cost details.
- RLS blocks unauthorized direct table access.

### Phase 3: Ledger Backend

Deliverables:

- `/api/transactions` GET/POST.
- `/api/transactions/[id]` PATCH.
- `/api/transactions/bulk` PATCH.
- TanStack Query integration for ledger.
- Optimistic inline edits and rollback.
- `transaction_revisions` and `audit_logs`.

Acceptance criteria:

- Manual entry persists.
- Inline edit persists and can be audited.
- Bulk edit persists.
- Filters remain URL-shareable and API-backed.
- Running totals reflect filtered server data.

### Phase 4: Metrics and Dashboard Aggregates

Deliverables:

- `/api/metrics/dashboard`.
- `/api/metrics/departments`.
- `/api/metrics/people`.
- `/api/metrics/calendar`.
- Move current `src/domain/metrics.ts` logic behind Drizzle/SQL queries.
- Return source row IDs for drill-down.

Acceptance criteria:

- Dashboard values match frontend prototype story.
- Every KPI/chart can trace to exact ledger rows.
- Aggregations are computed server-side.

### Phase 5: Categories and Recurring Templates

Deliverables:

- Category CRUD API.
- Recurring item API.
- Categorization rules persistence.
- CSV mapping rules persistence.

Acceptance criteria:

- Create/rename/archive persists.
- Historical transaction category IDs remain stable.
- Recurring templates persist with idempotency keys.

### Phase 6: CSV Import Pipeline

Deliverables:

- CSV upload endpoint.
- File hash duplicate prevention.
- Parsing and validation.
- Staging rows.
- Human review API.
- Commit approved rows in one transaction.
- Reverse import.

Acceptance criteria:

- Bad rows are blocked or require correction.
- Duplicate upload cannot double the books.
- Low-confidence rows require human confirmation.
- Committed rows appear in ledger and dashboard rollups.

### Phase 7: AI Backend

Deliverables:

- Claude API server integration.
- Categorization suggestions.
- Natural language query to validated filter object.
- Monthly briefing draft.
- Forecasting with assumptions.
- OCR draft transaction.
- AI audit and rate limits.

Acceptance criteria:

- At least categorization and natural language query are fully functional.
- AI never directly mutates ledger.
- Every AI claim has traceable source rows or aggregate references.

### Phase 8: Calendar and n8n Automation

Deliverables:

- Calendar events generated from recurring items.
- n8n recurring webhook.
- n8n external sync webhook.
- Slack/email alert webhook.
- Scheduled briefing webhook.
- `automation_runs` audit.

Acceptance criteria:

- Recurring generation is idempotent.
- External sync enters staging.
- Alerts do not mutate ledger data.
- Calendar remains linked to transactions/recurring items.

### Phase 9: Realtime and Query Invalidation

Deliverables:

- Supabase realtime subscriptions for transactions/imports/categories.
- TanStack Query invalidation by table/event.
- Query stale time tuning.

Acceptance criteria:

- Another user's ledger/category/import changes can refresh relevant UI.
- No manual page reload needed for common shared workflows.

### Phase 10: Cache Components and Production Hardening

Deliverables:

- Evaluate Next.js Cache Components for dashboard shell and aggregate reads.
- Run Supabase advisors.
- RLS test matrix.
- API route integration tests.
- Error logging.
- AI/import rate limits.
- Storage policies.

Acceptance criteria:

- Production build passes.
- Security advisors reviewed.
- Owner/staff permission matrix verified.
- Dashboard performance is acceptable with realistic data volume.

## Implementation Order Summary

1. Backend foundation.
2. Schema and seed.
3. Auth and permissions.
4. Ledger API and TanStack Query migration.
5. Metrics APIs.
6. Categories and recurring templates.
7. CSV import pipeline.
8. AI backend.
9. Calendar and n8n automation.
10. Realtime, cache, production hardening.

## Backend Done Definition

The backend phase is considered complete when:

- The frontend no longer depends on `src/data/mock-repository.ts` for production data.
- Ledger, dashboard, departments, people, calendar, categories, imports, AI, and settings read from backend APIs.
- Money-impacting mutations persist and are audited.
- Owner/staff permissions are enforced by both API checks and RLS.
- CSV imports cannot silently corrupt the ledger.
- AI suggestions are draft/review only until owner action.
- Recurring generation and external sync are idempotent.
- `pnpm build` passes and the backend decision log is current.
