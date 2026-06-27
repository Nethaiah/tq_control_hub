# TQ Management - Revenue & Expense Tracker (broad)

---

# 🧭 Techquarters Management Hub

## 🧩 Build Brief & Capability Evaluation

> **What this is.** A single internal system that lets a business owner manage **people, revenue, expenses, and the financial calendar** in one place. It is the owner's cockpit: everything that matters for a decision is visible, filterable, and linked.
> 
- **Why you are reading it.** This document is dual purpose: it is the full spec for the system, and it is the instrument we use to evaluate how you think, plan, and execute.
- **What we’re watching:** the *choices* you make as much as the result.
- **Backend reference.** This is a named entry in the Techquarters backend (proposed: **System Entry Two**). Treat your final data model and decision notes as documentation that a future engineer could pick up cold.

<aside>
⚠️

**Decision lens:** You are not building a bookkeeping tool. You are building a **decision tool**. Keep that distinction in your head the entire time.

</aside>

---

## 🗣️ 1. The vision in one breath

Most owners run their business off three things at once: a messy spreadsheet, their accountant's lagging numbers, and gut feel. By the time the real picture arrives, the decision window has closed.

- The Management Hub **replaces all three**.
- Every dollar in and out lands in **one ledger**, gets **categorised cleanly**, rolls up into **live charts**, and surfaces the handful of numbers that actually drive decisions.
- The owner should be able to open it on a Monday morning and answer: **“are we okay, and what do I do this week?”** in under **60 seconds**.

---

## 🧠 2. Think like the owner first

Before any UI, internalise what an owner is actually trying to answer. The whole system exists to answer these questions fast. This table is the analytical lens we expect you to design around.

| The owner asks | Metric that answers it | Why it drives a decision |
| --- | --- | --- |
| Are we making money right now? | Net profit, net margin % | Tells you if the model works at all this month |
| Is growth predictable? | MRR, net new MRR, MRR growth % | Recurring revenue is the compounding engine. Lumpy one off revenue hides the truth |
| Which parts of the business actually make money? | Department P&L, contribution margin per service line | Lets you double down, fix, or kill a line |
| How long can we survive? | Cash runway (months), burn rate | The single number that ends a business if ignored |
| Are we spending efficiently to grow? | CAC, LTV, LTV:CAC, payback period | Tells you if marketing and sales spend is building or burning |
| Are we dangerously dependent on one client? | Revenue concentration (% from top client) | A hidden risk that only shows when you visualise it |
| Are people costs in line? | Payroll as % of revenue, revenue per head | The biggest cost in a services business |
| What is coming that I need cash for? | Calendar of obligations (payroll, renewals, invoices due) | Cash timing kills profitable businesses |
| Is anything weird happening? | Variance vs budget, anomaly flags | Catches leaks and mistakes early |

<aside>
✅

If your dashboard answers these **nine questions** clearly, you have built the right thing. If it only shows “total money in, total money out,” you have built the wrong thing.

</aside>

---

## 🧪 3. The dummy business you are building against

We are giving you a fictional services agency so you have something concrete to model, populate, and visualise. It mirrors a real agency shape without using real figures. Use these structures as your seed data.

- **Company:** a technology services agency.
- **Revenue engines:** ✅ **high ticket one off system builds** + ✅ **compounding monthly retainers**.
- **Scale:** ~**12–18** staff + contractors.
- **Currency:** operating in **AED** with **USD reporting** (multi currency matters; see §12).

### 🏢 Departments

| Department | What lives here | Color (chart consistency) |
| --- | --- | --- |
| Sales | Closers, commissions, CRM, ad attribution | Steel blue |
| Marketing | Ad spend, content, lead gen tools | Steel blue (lighter) |
| Development | Engineers, build delivery, infrastructure | Amber |
| Design | Designers, design tooling | Teal |
| Onboarding / Client Success | Onboarding staff, retention, support | Coral |
| Operations / G&A | Admin, legal, accounting, office, overhead | Indigo |

### 💰 Revenue categories

- One off system builds
- Monthly retainers (recurring)
- AI agent subscriptions (recurring)
- Strategy and consulting
- Setup and onboarding fees

### 💸 Expense categories (with subcategories)

- **Payroll** > full time salaries
- **Contractors** > freelancers, per project
- **Software & subscriptions** > infrastructure, automation, AI API, design tools
- **Marketing & ad spend** > paid media, content, sponsorships
- **Tools & infrastructure** > hosting, domains, storage
- **Professional services** > legal, accounting, advisory
- **Office & overhead** > rent, utilities, equipment
- **Client costs** > pass through costs billed or absorbed

<aside>
ℹ️

These categories are deliberately realistic. One thing we are evaluating is whether you **respect and extend** a clean categorisation scheme, or whether you flatten everything into a vague list.

</aside>

---

## 🗂️ 4. The tabs

The Hub is organised into tabs. Each is specified below. **Simplicity** and clean **editability** are non negotiable across all of them. If a number is wrong, the owner should be able to fix it in **two clicks** without leaving the screen.

### 📒 4.1 Ledger tab (the source of truth)

The master table of every transaction, revenue and expense.

- **Columns:** date, type (revenue / expense), description, amount, currency, department, category, subcategory, client or vendor, recurring flag, source (manual / CSV / automation), attachment.
- **Stackable filters:** department AND category AND type AND date range AND client. Filters compose and are visible as removable chips. The active filter set should be shareable (think URL state) so a view can be sent to someone.
- **Inline editable:** edit any cell in place with optimistic update and undo.
- **Bulk edit:** select rows, change department/category once.
- **CSV upload:** drop a CSV of expenses, map its columns to the schema, preview, then commit (full pipeline in §8).
- **Add entry:** fast single-entry form for manual revenue or expense.
- **Search:** across description, client, vendor.
- **Running totals:** reflect the active filter set (not just the whole ledger).

### 🎛️ 4.2 Dashboard tab (the cockpit)

The page the owner opens first. **KPI cards** on top, **charts** below, a **global date range selector**, and drill down from any chart into the filtered ledger. Full chart catalogue in §7.

### 🧱 4.3 Departments tab

Each department is its own section/card and its own mini business.

- Per department: **revenue**, **cost**, **contribution margin**, **headcount**, **budget vs actual**, **trend**.
- Click into a department for its own ledger view and charts, pre-filtered to that department.
- Answers: **which parts make money** — visually and immediately.

### 👥 4.4 People / Team tab

Because the owner manages **people**, not just money.

- Staff and contractors: name, department, role, type (employee / contractor), cost (salary or rate), start date, status.
- Roll up: cost per department, payroll as % of revenue, revenue per head.
- Link a person to the transactions that represent their cost so payroll flows into the ledger and the department P&L automatically.

### 🗓️ 4.5 Calendar tab

The financial calendar: what is due and when.

- **Event types:** payroll dates, retainer billing cycles, invoices due, subscription renewals, tax/compliance dates, scheduled reviews.
- Month view + upcoming list view.
- Events can be generated automatically from recurring items (§10) and can link back to the transaction they represent.
- Surfaces **cash needed in the next 30 days** so the owner is never surprised.

### 🧾 4.6 Category settings tab

Where the categorisation scheme is managed.

- Create, rename, archive categories and subcategories for both revenue and expense.
- Define recurring item templates (e.g., retainer auto-creates revenue monthly; subscription auto-creates expense monthly).
- Define rules for automatic categorisation and CSV mapping (e.g. vendor contains “Vercel” → Software & subscriptions > infrastructure).

<aside>
✅

This tab is what makes the system **reconfigurable** for a different business later. Treat categories as **data**, never hardcoded values.

</aside>

### 🤖 4.7 AI assistant / insights tab

The AI layer surfaced as its own surface (detail in §9).

- Natural language questions over the data (“show marketing spend last quarter against new revenue”).
- Auto-generated monthly briefing in plain English.
- Anomaly and risk flags.

### 🔌 4.8 Settings / integrations tab

Currency + reporting currency, fiscal year start, connected sources (Stripe, bank feed, accounting tool), notification destinations (Slack, email), and user roles/permissions.

---

## 🧱 5. The data model

We are not handing you the schema. We want to see yours. But here is the entity set it must support, and the relationships are where we read your skill.

| Entity | Key fields | Notes |
| --- | --- | --- |
| transactions | id, date, type, amount, currency, fx_rate, department_id, category_id, subcategory_id, client_id?, vendor?, recurring, recurrence_id?, source, description, attachment_url, created_by | The ledger. The hot table. Design it to aggregate well |
| departments | id, name, color, monthly_budget |  |
| categories | id, name, kind (revenue/expense), parent_id? | Self referencing for subcategories |
| clients | id, name, status, start_date, mrr | Powers concentration and LTV |
| people | id, name, department_id, role, type, cost, cadence, status | Powers payroll and revenue per head |
| recurring_items | id, type, amount, cadence, next_run, department_id, category_id, template | Generates transactions and calendar events |
| calendar_events | id, title, date, type, amount?, transaction_id?, recurring_item_id? |  |
| csv_imports | id, filename, uploaded_at, row_count, status, column_mapping | Audit trail for imports |

**What we are reading from your model:**

- Are revenue and expense one table with a type, or two tables? **Defend your choice.**
- How do you store currency so USD reporting stays correct when AED entries change?
- How do recurring items avoid double counting when generated?
- Can a category be reassigned across thousands of rows without breaking historical reports?

---

## 🧷 6. Filtering and editing standard

This is the part most people underestimate. Read it twice.

- Filters are **stackable and composable**. The active set is one object, applied to the ledger and to every total and chart on screen.
- Filtering must not mean “fetch everything then filter in the browser.” Aggregations and rollups should be computed **server-side** (SQL views/queries), not assembled client-side from raw rows.
- Editing is **inline**, **optimistic**, and **reversible**. No modal mazes to change one number.
- Bulk edit is first class: select rows, change department or category once.
- Every derived number on screen must trace back to the rows that produced it. Click a KPI, land in the filtered ledger that explains it.

<aside>
⚠️

Non-negotiable: every KPI and chart must support **drill-down** to the exact ledger rows that produced it.

</aside>

---

## 📊 7. The dashboard chart catalogue

The dashboard must be full of charts, and every chart must earn its place by answering one of the nine owner questions. Choosing the right chart type for each metric is itself part of the evaluation. **Pie charts everywhere is a fail.**

- **KPI cards (top row):** Net profit, Net margin %, MRR, Cash runway (months), anomaly flag count.
- Each card shows: **value**, **change vs previous period**, **direction**.

| Chart | Type | Question it answers |
| --- | --- | --- |
| Revenue vs expenses over time | Combo: bars for revenue and expense, line for net profit | Are we making money, and is the gap widening |
| MRR trend with movement | Stacked bars: new, expansion, churn, plus MRR line | Is growth predictable and healthy |
| Revenue by department | Stacked bar over time, or 100% stacked | Where revenue comes from |
| Expense breakdown by category | Treemap or donut | Where the money goes |
| Profit margin trend | Line | Is the business getting more or less efficient |
| Department P&L | Table with revenue, cost, margin, margin % per department | Which lines make money |
| Revenue type split | Donut: one off vs recurring | How dependent we are on lumpy project work |
| Top clients by revenue | Horizontal bar with a concentration callout | Client risk |
| Cash runway | Gauge or simple big number with trend | Survival |
| Budget vs actual by department | Bullet or grouped bar | Are departments overspending |
- Global date range selector controls the whole page.
- Every chart is a **drill-down** entry point into the ledger.

---

## 📥 8. CSV import pipeline

The owner will upload real, messy CSVs of expenses. Handle reality, not the happy path.

1. **Upload** a file. Detect delimiter, encoding, and header row.
2. **Map columns** to the schema. Remember mappings per file shape so repeat uploads are one click.
3. **Validate** rows: bad dates, missing amounts, wrong currency, obvious duplicates against existing transactions.
4. **Auto categorise** each row using rules and AI suggestion, with a confidence score (§9).
5. **Review** in a staging view. Low confidence rows are flagged for the human to confirm. Nothing commits silently.
6. **Commit** to the ledger, logged in csv_imports for audit and reversibility.

<aside>
⚠️

We are watching for: **duplicate handling**, **date/currency parsing**, and whether you let bad data into the **source of truth**. Idempotency matters. Uploading the same file twice should not double the books.

</aside>

---

## 🤖 9. The AI layer

This is where we find out if you understand AI as a tool rather than a sprinkle. Every AI feature must have a clear job, a confidence story, and a human in the loop where money is involved.

| AI feature | What it does | The discipline we expect |
| --- | --- | --- |
| Automatic categorisation | Classifies imported rows into category, subcategory, department with confidence | Low confidence routes to human review. Never silent on the books |
| Natural language query | "Marketing spend last quarter vs new revenue" becomes a filtered view and chart | Translate intent into the existing filter and aggregation layer, do not invent numbers |
| Monthly briefing | Plain English summary of what happened and what to watch | Generated from real aggregates, every claim traceable to data |
| Anomaly detection | Flags expense spikes, revenue drops, unusual transactions | Surfaced as flags, owner confirms or dismisses |
| Forecasting | Projects MRR, runway, expense trend | Show the assumptions, label it a projection |
| Receipt / invoice OCR | Photo or PDF becomes a draft transaction | Draft only, human confirms before commit |

<aside>
✅

The line we are testing: AI **proposes**, the human **commits** anything that touches the books.

</aside>

---

## ⚙️ 10. The automation layer

Automations remove the manual work. The automation brain is **n8n**. Tell us what should be automated and how you keep it safe.

- **Recurring generation:** retainers auto create revenue each cycle; subscriptions auto create an expense. Must be **idempotent** (missed/replayed run never double posts).
- **Calendar population:** recurring items generate calendar events + renewal reminders.
- **External sync:** Stripe (revenue), bank feed/accounting tool (expenses) into staging → through the same validate + categorise pipeline.
- **Alerts:** runway below X months, department over budget, concentration risk, large unusual expense → Slack/email.
- **Scheduled reporting:** end of month, generate and deliver the briefing.

<aside>
ℹ️

Where you draw the line between “automate it” and “keep a human in it” tells us how you think about risk.

</aside>

---

## 🧾 11. Seed data to build against

Use this as the starting dataset so your dashboard has something real to show. Extend it as needed.

### 💰 Sample revenue (one month, illustrative)

| Date | Description | Amount (USD) | Type | Department | Category | Client |
| --- | --- | --- | --- | --- | --- | --- |
| 03 Jun | Build project, lead system | 18,000 | Revenue | Development | One off build | Client A |
| 05 Jun | Retainer, June | 4,000 | Revenue | Onboarding | Monthly retainer | Client B |
| 05 Jun | Retainer, June | 3,500 | Revenue | Onboarding | Monthly retainer | Client C |
| 10 Jun | AI agent subscription | 1,200 | Revenue | Development | AI subscription | Client D |
| 15 Jun | Strategy sprint | 6,000 | Revenue | Sales | Consulting | Client E |

### 💸 Sample expenses (one month, illustrative)

| Date | Description | Amount (USD) | Type | Department | Category | Vendor |
| --- | --- | --- | --- | --- | --- | --- |
| 01 Jun | Engineer salary | 5,500 | Expense | Development | Payroll | Internal |
| 01 Jun | Designer salary | 3,800 | Expense | Design | Payroll | Internal |
| 02 Jun | Meta ad spend | 4,200 | Expense | Marketing | Ad spend | Meta |
| 04 Jun | Automation platform | 120 | Expense | Operations | Software | n8n |
| 04 Jun | Database & hosting | 260 | Expense | Development | Tools | Supabase / Vercel |
| 06 Jun | AI API usage | 740 | Expense | Development | Software | Claude API |
| 12 Jun | Contractor, build | 2,400 | Expense | Development | Contractors | Freelancer |
| 20 Jun | Accounting | 600 | Expense | Operations | Professional services | Accountant |

This deliberately produces a positive month with a clear margin, a heavy development cost base, and a marketing line you can test CAC against. Your charts should make that story obvious at a glance.

---

## 🧱 12. The hard parts (where we are really watching)

These are the problems that separate someone who can build a screen from someone who can build a system. We are not giving you the answers. We want to see yours.

- **Aggregation at scale:** computing MRR, margins, runway, rollups efficiently (server-side) as the ledger grows.
- **Stackable filter architecture:** one composable filter object driving ledger + totals + charts (shareable state).
- **Recurring without double counting:** clean recurrence modelling, idempotent generation, correct handling of mid-month starts/proration.
- **CSV reality:** messy headers, date formats, encodings, duplicates; validate + map + review (no silent commits).
- **Multi currency:** AED entries, USD reporting, stored FX so historical reports stay correct as rates move.
- **AI with judgement:** confidence scoring, human-in-loop on anything financial, cost/latency control, never fabricating a number.
- **Editability without breakage:** reassigning categories across thousands of rows without corrupting past reports.
- **Permissions:** owner view vs staff view.

<aside>
✅

For each of these, in your submission, tell us your approach and the tradeoff you chose. A clear “I did X because Y, and the cost is Z” beats a perfect demo with no reasoning.

</aside>

---

## 📦 13. What we expect you to deliver

1. **A working dashboard** built against the seed data, covering at minimum the Ledger, Dashboard, Departments, and Category settings tabs.
2. **Your data model**, with short notes on the key decisions (§5 questions answered).
3. **The CSV import pipeline** working end to end on a messy sample file.
4. **At least two AI features** from §9, including confidence + human-in-loop.
5. **A short decision log** (one page): what you chose, what you skipped, what you would do next with more time.

### 🧭 Suggested phases (yours to adjust)

- **Phase 1:** data model, ledger, manual entry, stackable filters, inline editing.
- **Phase 2:** dashboard charts and KPI cards, department rollups.
- **Phase 3:** CSV import pipeline with validation and review.
- **Phase 4:** AI categorisation + natural language query, calendar + recurring automation.

---

## 🧮 14. How we score you

| Dimension | What good looks like |
| --- | --- |
| Business judgement | Surfaces the metrics that drive decisions, not just totals. Chooses the right chart for each |
| Data modelling | Clean, normalised, aggregates well, reconfigurable. Categories are data |
| Filtering and performance | Composable filters, server side aggregation, fast at scale |
| CSV and data integrity | Handles mess, prevents duplicates, never poisons the source of truth |
| AI maturity | Clear job per feature, confidence aware, human in the loop, cost conscious |
| Automation safety | Idempotent, sensible automate versus human boundary |
| UX and editability | Simple, fast, inline edits, two click fixes, drill down everywhere |
| Communication | The decision log. Can you explain why, not just what |

---

## 🧰 15. Stack and constraints

Our environment, for context. You may justify alternatives, but tell us why.

- **Database:** Supabase (Postgres, realtime) — the operational system of record.
- **Frontend / deploy:** Next.js on Vercel.
- **Automation:** n8n cloud.
- **AI:** Claude API.
- **Mirrors:** Notion and Airtable are human readable mirrors only — never the operational database.
- **Currency:** AED operating, USD reporting.

---

## 📤 16. How to submit

Send us the working build (deployed link preferred), the repository, your data model note, and your one-page decision log. We read the decision log first.

- Build it like it is going into production.
- Build it like the next engineer has to maintain it without you.

That is exactly the situation you would be in here.