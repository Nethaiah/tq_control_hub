# Techquarters Management Hub

Internal owner cockpit for revenue, expenses, people, departments, CSV imports, AI review, and the financial calendar. The build follows `docs/context/ORIGINAL_PRD.md` as a decision tool, not a bookkeeping clone.

## What To Review First

- Submission decision log: `docs/decisions/SUBMISSION_DECISION_LOG.md`
- Backend/data model decisions: `docs/decisions/BACKEND_DECISION_LOG.md`
- Original brief: `docs/context/ORIGINAL_PRD.md`
- CSV fixture: `fixtures/imports/techquarters-june-expenses.csv`

## Implemented Scope

- Dashboard with KPI cards, chart catalogue, date range control, drill-down links, department P&L, runway, concentration, and growth-efficiency surfaces.
- Ledger with server-backed pagination/filtering/totals, URL-shareable filters, inline edits, bulk edits, manual entry, search, and audit/revision writes.
- Departments, People, Calendar, Category Settings, Imports, AI Insights, and Settings workspace routes.
- Supabase/Postgres schema through Drizzle, including organizations, members, departments, categories, clients, people, transactions, recurring items, calendar events, CSV imports/staged rows, AI suggestions, audit logs, and RLS policies.
- CSV pipeline with header mapping, date/amount/currency validation, duplicate detection, staging review, commit, reverse, confidence, and audit trail.
- AI features for CSV categorization and natural-language query translation through OpenRouter, with confidence and human-in-loop boundaries.

## Known Gaps

- Dashboard metrics are correct for MVP, but not every chart aggregate has been moved into SQL views/RPCs yet.
- Recurring automation is modeled with idempotency keys and run tables, but n8n generation/proration is not complete.
- FX is stored per transaction for stable USD reporting, but live FX-rate ingestion is not implemented.
- Owner/staff permissions and RLS exist, but staff/payroll-safe UX needs more production testing.
- OpenRouter is used as the AI gateway; a direct Claude API client can replace it behind the same AI functions if required.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000` and sign in with a seeded Supabase user for the `techquarters` organization.

## Useful Commands

```bash
pnpm build
pnpm lint
pnpm db:generate
pnpm db:migrate
pnpm db:rls-smoke
```

## Demo Path

1. Start at `/dashboard` for the owner cockpit and drill into ledger-backed numbers.
2. Open `/ledger` to test stackable URL filters, inline edits, bulk edit, manual entry, and running totals.
3. Open `/imports` and upload `fixtures/imports/techquarters-june-expenses.csv` to see validation, duplicate handling, human review, commit, and reversal.
4. Open `/insights` to test AI categorization/query workflows and confidence-gated review.
5. Open `/categories` to review category-as-data, recurring templates, and CSV mapping rules.

## Stack

- Next.js 16 App Router on React 19.
- Supabase Auth/Postgres/RLS as the operational source of truth.
- Drizzle ORM for schema, migrations, typed queries, and mutations.
- TanStack Query for server-state cache, mutations, optimistic updates, and invalidation.
- TanStack Table for reusable data tables with server-side modes.
- OpenRouter for AI routing during MVP development.
- n8n is the planned automation runtime for recurring generation, external sync, alerts, and scheduled reports.
