# Techquarters Management Hub Backend Decision Log

## Purpose

This is the backend decision log for the post-frontend implementation phase. It is separate from `DECISION_LOG.md`, which documents the frontend prototype. This file records backend architecture decisions, tradeoffs, and the reasoning required by `ORIGINAL_PRD.md`.

## Current Backend Status

Backend implementation is now underway. The app has a Supabase/Postgres schema managed with Drizzle, migrations, Auth/RLS policy coverage, API route handlers, TanStack Query-backed client workflows, persistent ledger/category/import/AI data paths, CSV staging/commit/reversal, OpenRouter-backed AI categorization/query translation, and audit logging. Remaining backend work is deeper SQL aggregation for all dashboard charts, n8n automation, production external integrations, full recurring generation/proration, and final permission hardening.

## Chosen Stack

| Layer | Decision |
| --- | --- |
| Database | Supabase Postgres |
| ORM/query layer | Drizzle ORM |
| Postgres driver | `postgres` with Supabase transaction pooler and `prepare: false` |
| Auth/session | `@supabase/ssr` |
| Realtime/storage | `@supabase/supabase-js` |
| API boundary | Next.js App Router route handlers in `app/api/*` |
| Client data cache | TanStack Query |
| Automation | n8n |
| AI | Claude API |
| Later performance | Next.js Cache Components |

## Decision: Supabase Postgres As Operational Source Of Truth

Supabase Postgres is the system of record because `ORIGINAL_PRD.md` names Supabase as the expected database and because the product needs RLS, auth, storage, realtime, and Postgres-level integrity.

Tradeoff:

- Benefit: strong database constraints, RLS, and operational ownership.
- Cost: we must design policies carefully and avoid relying only on frontend/API checks.

## Decision: Drizzle For Data Access

Drizzle will handle schema, migrations, typed queries, and aggregate queries. The Supabase query builder will not be the core data access layer.

Reasons:

- Dashboard metrics require complex joins, filters, grouping, and conditional aggregation.
- Drizzle keeps queries type-safe and reviewable in TypeScript.
- Existing frontend architecture already has a repository layer (`src/data/mock-repository.ts`) that can be replaced by Drizzle-backed repositories.

Tradeoff:

- Benefit: better query type safety and migration structure.
- Cost: RLS policies, triggers, and some views still require SQL.

## Decision: Keep Supabase SSR And Supabase JS

Even with Drizzle, we still need Supabase clients.

Use cases:

- `@supabase/ssr`: server/browser auth sessions and cookie refresh.
- `@supabase/supabase-js`: realtime channels and storage uploads.

What we will not use it for:

- Core ledger/category/import/metrics queries.

Tradeoff:

- Benefit: Supabase handles auth/realtime/storage correctly.
- Cost: two data-related tools exist, so boundaries must be documented and followed.

## Decision: API Routes Instead Of Only Server Actions

Backend mutations and reads will be exposed through Next.js `app/api/*` route handlers.

Reasons:

- TanStack Query works naturally with HTTP endpoints.
- API routes are independently testable.
- n8n and future external clients can call the same backend surface.
- HTTP methods map cleanly to product actions: GET, POST, PATCH.

Tradeoff:

- Benefit: clear contract and reuse outside Next.js UI.
- Cost: more route files and explicit request/response handling.

## Decision: TanStack Query For Client Cache And Optimistic Updates

TanStack Query will replace local React state for backend-backed workflows.

Use cases:

- Ledger rows and filters.
- Inline edits with optimistic updates and rollback.
- Bulk edits.
- Category and recurring template mutations.
- CSV staging, review, commit, and reversal.
- AI suggestion apply/dismiss.
- Realtime-triggered invalidation.

Tradeoff:

- Benefit: robust cache, invalidation, and mutation lifecycle.
- Cost: query keys and invalidation rules must be maintained carefully.

## Decision: One Transactions Table

Revenue and expenses stay in one `transactions` table with a `type` field.

Reasons:

- PRD requires one ledger source of truth.
- Shared filters, audit trails, drill-down, and dashboard rollups are simpler.
- CSV imports and external sync can stage into one target model.

Tradeoff:

- Benefit: one ledger, one filter model, one audit story.
- Cost: type-specific validation must be enforced in API and database constraints where possible.

## Decision: Store Currency And FX Per Transaction

Each transaction stores original `currency` and historical `fx_rate_to_usd`.

Reasons:

- AED operating entries must support stable USD reporting.
- Historical reports should not change when exchange rates move.

Tradeoff:

- Benefit: deterministic reporting.
- Cost: updates involving currency need explicit FX handling.

## Decision: Categories Are Data With Stable IDs

Categories and subcategories are persisted rows with `parent_id`, `kind`, and `archived`.

Reasons:

- PRD requires the system to be reconfigurable for different businesses.
- Historical transaction rows should keep stable category IDs even if category names change.

Tradeoff:

- Benefit: safe category rename/archive behavior.
- Cost: archive must not delete rows that historical transactions reference.

## Decision: Owner And Staff Permission Model

`ORIGINAL_PRD.md` asks for owner view vs staff view but does not define it, so we define a minimal MVP model.

Roles:

- `owner`: full access to the organization and final authority for financial commits.
- `staff`: department-scoped access, can prepare drafts, cannot commit money-impacting changes.

Owner can:

- View all ledger, dashboard, departments, people costs, calendar, settings.
- Add/edit/bulk edit transactions.
- Commit/reverse CSV imports.
- Manage categories and recurring templates.
- Apply/dismiss AI suggestions.
- Manage integrations and automation policies.

Staff can:

- View assigned department rows only.
- Prepare CSV staging rows but not commit.
- Draft AI suggestions but not apply them.
- View non-sensitive assigned-department people records.
- Not view payroll cost details unless explicitly granted later.
- Not manage settings/integrations/categories archive/recurring commits.

Enforcement:

- API routes check permissions explicitly.
- Supabase RLS enforces organization and department access at the database level.
- Payroll-sensitive rows use RLS or staff-safe views.

Tradeoff:

- Benefit: clear safety boundary for financial operations.
- Cost: additional membership/access tables and RLS policy complexity.

## Decision: Organization Boundary From Day One

All business tables include `organization_id`.

Reasons:

- Clean RLS predicates.
- Future support for additional businesses without refactoring every table.
- Owner/staff permissions are scoped to organization membership.

Tradeoff:

- Benefit: scalable authorization model.
- Cost: every query must include org context.

## Decision: RLS Plus API Guards

We use both API-level authorization and Supabase RLS.

Reasons:

- API guards produce helpful errors and enforce business rules.
- RLS protects against accidental direct table exposure and missed API checks.

Rules:

- Enable RLS on all exposed tables.
- Use `TO authenticated` plus organization/ownership predicates.
- Avoid `auth.role()`.
- For update policies, include both `USING` and `WITH CHECK`.
- Avoid `SECURITY DEFINER` unless strictly necessary.
- Use `security_invoker = true` for exposed views on Postgres 15+.

Tradeoff:

- Benefit: defense in depth.
- Cost: more policy testing required.

## Decision: CSV Imports Stage Before Commit

CSV imports never write directly to `transactions`.

Flow:

1. Upload file.
2. Compute file hash.
3. Detect duplicate upload.
4. Parse rows.
5. Validate rows.
6. Add rules/AI suggestions.
7. Stage rows.
8. Human reviews low-confidence or blocked rows.
9. Owner commits approved rows.
10. Import can be reversed/audited.

Tradeoff:

- Benefit: source of truth is protected from bad data.
- Cost: more tables and workflow states.

## Decision: AI Proposes, Human Commits

AI never directly mutates money-impacting tables.

AI outputs are stored as `ai_suggestions` with:

- Feature type.
- Confidence.
- Proposed action.
- Review state.
- Source transaction IDs or aggregate references.
- Assumptions for projections.

Tradeoff:

- Benefit: aligns with PRD's human-in-loop requirement.
- Cost: every AI feature needs review/apply plumbing.

## Decision: n8n Automations Are Idempotent And Staged

n8n can trigger recurring generation, calendar population, external sync, alerts, and reporting, but money-impacting outputs must be idempotent and staged.

Rules:

- Recurring generation uses unique idempotency keys.
- External sync enters staging and validation.
- Alerts notify only; they do not mutate ledger data.
- Scheduled briefing creates a draft for owner review.

Tradeoff:

- Benefit: automation reduces work without risking duplicate books.
- Cost: every automation needs run tracking and replay protection.

## Decision: Cache Components Later, Not First

Next.js Cache Components can be considered after backend data boundaries stabilize.

Reasons:

- First priority is correctness: RLS, API routes, server-side aggregates, mutation safety.
- Premature caching could hide permission bugs or stale financial data.

Planned use later:

- Static dashboard shell.
- Expensive aggregate reads with safe tags/revalidation.
- Settings/static reference data.

Tradeoff:

- Benefit: avoids optimizing before correctness.
- Cost: performance tuning comes after functional backend work.

## Initial Backend Roadmap

1. Backend foundation: env, Supabase clients, middleware, Drizzle, TanStack Query provider.
2. Schema and seed data.
3. Auth and owner/staff permissions.
4. Ledger API and TanStack Query migration.
5. Server-side metrics APIs.
6. Categories and recurring templates.
7. CSV import pipeline.
8. AI backend.
9. Calendar and n8n automation.
10. Realtime invalidation, Cache Components, production hardening.

## Risks To Track

- RLS policies can silently block updates without SELECT policies.
- Views can bypass RLS unless `security_invoker` is used.
- Supabase service role key must never reach the browser.
- Transaction pooler needs `prepare: false`.
- Staff payroll visibility must be tested carefully.
- CSV duplicate detection must cover both file-level and row-level duplicates.
- AI query output must be validated before use.
- n8n webhooks require shared secret verification and idempotency.

## Current Next Step

Start Phase 0 from `report/backend-implementation-plan.md`.
