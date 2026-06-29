# Techquarters Management Hub — Submission

## Deliverables (§13)

| # | Requirement | Where to find it |
| --- | --- | --- |
| 1 | Working dashboard against seed data | See local setup below. Ledger, Dashboard, Departments, and Category Settings tabs are fully built and seeded. |
| 2 | Data model with key decisions | `src/lib/db/schema.ts` (Drizzle schema). Decisions documented in `docs/decisions/BACKEND_DECISION_LOG.md` (one vs two tables, FX storage, categories as data, recurring idempotency, CSV staging). |
| 3 | CSV import pipeline on messy sample | `fixtures/imports/techquarters-june-expenses.csv` includes valid rows + duplicate + bad date + unsupported currency. Pipeline: file hash duplicate blocking, date/amount/currency parsing, staging review, AI categorization, human confirmation, commit, reverse, audit trail. |
| 4 | At least two AI features with confidence + human-in-loop | Categorization (confidence-gated review, low-confidence routes to human) and natural-language query translation (intent mapped to existing filter/aggregation layer). Both in `src/lib/ai/openrouter.ts`. |
| 5 | One-page decision log | `docs/decisions/SUBMISSION_DECISION_LOG.md` |

## Links

- **Repository:** https://github.com/Nethaiah/tq_control_hub
- **Decision log (read this first):** `docs/decisions/SUBMISSION_DECISION_LOG.md`
- **Data model note:** `docs/decisions/BACKEND_DECISION_LOG.md` + `src/lib/db/schema.ts`
- **CSV fixture:** `fixtures/imports/techquarters-june-expenses.csv`
- **Build:** `pnpm build` passes (Postgres required for runtime).

## Hard Parts Response (§12)

Each is addressed with approach, tradeoff, and honest gap in `docs/decisions/SUBMISSION_DECISION_LOG.md`.

## Stack

Supabase (Postgres + Auth + RLS), Drizzle ORM, Next.js 16 App Router, TanStack Query, TanStack Table, OpenRouter (AI), Recharts. n8n is the planned but not-yet-live automation runtime. AED operating, USD reporting with stored FX per transaction.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Demo Path

1. `/dashboard` — owner cockpit with drill-down.
2. `/ledger` — stackable URL filters, inline edits, bulk edit, running totals.
3. `/imports` — upload `fixtures/imports/techquarters-june-expressions.csv`, see validation, duplicates, human review, commit, reversal.
4. `/insights` — AI categorization + NL query with confidence-gated review.
5. `/categories` — categories as data, recurring templates, mapping rules.
