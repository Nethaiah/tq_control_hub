# Techquarters Management Hub PRD and MVP Plan

## 1. Product Summary

### Product Name

Techquarters Management Hub

### Product Type

Internal business management system for people, revenue, expenses, and the financial calendar.

### Core Positioning

This is not a bookkeeping tool. It is a decision tool for a business owner.

The owner should be able to open the system on a Monday morning and answer:

> Are we okay, and what do I do this week?

The target time to answer that question is under 60 seconds.

### Primary User

Business owner of a technology services agency.

### Business Context

The dummy business is a technology services agency with:

- High ticket one off system builds
- Compounding monthly retainers
- AI agent subscriptions
- Strategy and consulting revenue
- Setup and onboarding fees
- Around 12 to 18 staff and contractors
- AED operating currency with USD reporting

---

## 2. Product Goal

Replace the owner's current mix of:

- Messy spreadsheet
- Lagging accountant numbers
- Gut feel

with one internal system where:

- Every dollar in and out lands in one ledger
- Transactions are categorised cleanly
- Metrics roll up into live charts
- Key financial risks and decisions are surfaced quickly
- Every KPI and chart can drill down into the exact ledger rows behind it

---

## 3. Decision Questions the Product Must Answer

The whole product exists to answer these nine owner questions.

| Owner Question | Required Metric | Decision Purpose |
| --- | --- | --- |
| Are we making money right now? | Net profit, net margin % | Shows whether the business model works this month |
| Is growth predictable? | MRR, net new MRR, MRR growth % | Shows whether recurring revenue is compounding |
| Which parts of the business actually make money? | Department P&L, contribution margin per service line | Shows what to double down on, fix, or kill |
| How long can we survive? | Cash runway, burn rate | Shows survival risk |
| Are we spending efficiently to grow? | CAC, LTV, LTV:CAC, payback period | Shows whether sales and marketing spend is building or burning |
| Are we dependent on one client? | Revenue concentration from top client | Shows hidden client concentration risk |
| Are people costs in line? | Payroll as % of revenue, revenue per head | Shows whether people cost matches business scale |
| What is coming that needs cash? | Calendar of obligations | Shows upcoming payroll, renewals, invoices, tax, and reviews |
| Is anything weird happening? | Variance vs budget, anomaly flags | Catches leaks, mistakes, spikes, and drops early |

---

## 4. MVP Scope

The MVP should satisfy the minimum delivery expectation from the brief:

1. Working dashboard built against the seed data
2. Ledger tab
3. Dashboard tab
4. Departments tab
5. Category settings tab
6. Data model with decision notes
7. CSV import pipeline working end to end on a messy sample file
8. At least two AI features from the brief, with confidence and human-in-the-loop handling
9. One-page decision log covering choices, skipped items, and next steps

### Core MVP vs Full PRD

The MVP is the minimum build required to satisfy the assessment brief. The full PRD still includes every tab and capability described in the Notion/MD spec, but not every full-product feature has to be fully implemented in the first MVP.

Core MVP means:

- Must be built and demonstrable
- Must work against the seed data
- Must support the decision-tool goal
- Must be covered in the data model and decision notes

Full PRD / later-phase scope means:

- Still part of the product plan because it is in the brief
- Can be documented, designed, or partially stubbed if time is limited
- Can be built after the core MVP unless the team chooses a larger MVP

Examples of full PRD / later-phase scope:

- People / Team tab
- Calendar tab
- Settings / Integrations tab
- Full n8n automation
- Forecasting
- OCR
- Monthly briefing
- Full permissions model

### MVP Must Prove

- The ledger is the source of truth
- Filters are stackable and shared across ledger, totals, and charts
- Aggregations are computed server-side
- Every KPI and chart drills down into ledger rows
- Categories are data, not hardcoded values
- CSV imports do not silently poison the ledger
- AI proposes, but the human commits anything that touches the books
- Recurring and automation logic is idempotent where implemented or documented
- AED operating entries can support USD reporting using stored FX rates

---

## 5. Full Product Surface

### 5.1 Ledger Tab

The Ledger tab is the source of truth.

Required columns:

- Date
- Type: revenue or expense
- Description
- Amount
- Currency
- Department
- Category
- Subcategory
- Client or vendor
- Recurring flag
- Source: manual, CSV, or automation
- Attachment

Required capabilities:

- Stackable filters by department, category, type, date range, and client
- Visible removable filter chips
- Shareable active filter state
- Inline cell editing with optimistic update and undo
- Bulk edit for department and category
- CSV upload, mapping, preview, and commit
- Fast manual revenue or expense entry
- Search across description, client, and vendor
- Running totals based on the active filter set

### 5.2 Dashboard Tab

The Dashboard tab is the owner's cockpit.

Required layout:

- KPI cards on top
- Charts below
- Global date range selector
- Drill-down from each KPI and chart into filtered ledger rows

Required KPI cards:

- Net profit
- Net margin %
- MRR
- Cash runway in months
- Anomaly flag count

Each KPI card must show:

- Current value
- Change vs previous period
- Direction

Required dashboard charts:

| Chart | Type | Purpose |
| --- | --- | --- |
| Revenue vs expenses over time | Combo chart: revenue and expense bars, net profit line | Shows whether the business is making money and whether the gap is widening |
| MRR trend with movement | Stacked bars for new, expansion, churn, plus MRR line | Shows recurring growth health |
| Revenue by department | Stacked bar over time or 100% stacked | Shows where revenue comes from |
| Expense breakdown by category | Treemap or donut | Shows where money goes |
| Profit margin trend | Line chart | Shows efficiency trend |
| Department P&L | Table | Shows revenue, cost, margin, and margin % by department |
| Revenue type split | Donut | Shows one off vs recurring dependence |
| Top clients by revenue | Horizontal bar with concentration callout | Shows client risk |
| Cash runway | Gauge or large number with trend | Shows survival position |
| Budget vs actual by department | Bullet or grouped bar | Shows overspending risk |

### 5.3 Departments Tab

Each department is treated as its own mini business.

Required department metrics:

- Revenue
- Cost
- Contribution margin
- Headcount
- Budget vs actual
- Trend

Required behavior:

- Each department has its own section or card
- Clicking a department opens a department-specific ledger view
- Department view is pre-filtered to that department
- Department charts show which parts of the business make money

### 5.4 People / Team Tab

The People / Team tab represents people costs and headcount.

Required fields:

- Name
- Department
- Role
- Type: employee or contractor
- Cost: salary or rate
- Start date
- Status

Required rollups:

- Cost per department
- Payroll as % of revenue
- Revenue per head

Required behavior:

- A person can link to transactions representing their cost
- Payroll flows into the ledger
- Department P&L updates automatically from linked people costs

### 5.5 Calendar Tab

The Calendar tab shows financial obligations and upcoming cash timing.

Required event types:

- Payroll dates
- Retainer billing cycles
- Invoices due
- Subscription renewals
- Tax and compliance dates
- Scheduled reviews

Required views:

- Month view
- Upcoming list view

Required behavior:

- Events can be generated from recurring items
- Events can link back to transactions
- Calendar surfaces cash needed in the next 30 days

### 5.6 Category Settings Tab

Category settings make the system configurable for other businesses later.

Required capabilities:

- Create categories and subcategories
- Rename categories and subcategories
- Archive categories and subcategories
- Manage both revenue and expense categories
- Define recurring item templates
- Define rules for automatic categorisation
- Define CSV mapping rules

Important rule:

Categories must be stored as data, not hardcoded values.

### 5.7 AI Assistant / Insights Tab

The AI layer has its own surface.

Required AI capabilities from the brief:

- Automatic categorisation
- Natural language query
- Monthly briefing
- Anomaly detection
- Forecasting
- Receipt or invoice OCR

MVP requirement:

- At least two AI features
- Each AI feature must have confidence handling
- Any AI action affecting the books must require human confirmation before commit

### 5.8 Settings / Integrations Tab

Required settings:

- Operating currency
- Reporting currency
- Fiscal year start
- Connected sources: Stripe, bank feed, accounting tool
- Notification destinations: Slack and email
- User roles and permissions

Important rule:

Notion and Airtable may be human-readable mirrors only. They must never be the operational database.

---

## 6. Required Data Model

The system must support these entities.

| Entity | Key Fields | Purpose |
| --- | --- | --- |
| transactions | id, date, type, amount, currency, fx_rate, department_id, category_id, subcategory_id, client_id, vendor, recurring, recurrence_id, source, description, attachment_url, created_by | Source of truth ledger |
| departments | id, name, color, monthly_budget | Department reporting and P&L |
| categories | id, name, kind, parent_id | Revenue and expense categories, with subcategories |
| clients | id, name, status, start_date, mrr | Client revenue, concentration, LTV |
| people | id, name, department_id, role, type, cost, cadence, status | Payroll and revenue per head |
| recurring_items | id, type, amount, cadence, next_run, department_id, category_id, template | Generates transactions and calendar events |
| calendar_events | id, title, date, type, amount, transaction_id, recurring_item_id | Financial calendar |
| csv_imports | id, filename, uploaded_at, row_count, status, column_mapping | CSV audit and reversibility |

### Data Model Decisions to Document

The submission must explain:

- Whether revenue and expense use one transactions table with a type field, or separate tables
- How currency and FX rates are stored so USD reports stay historically correct
- How recurring items avoid double counting
- How category reassignment works across many rows without breaking historical reports

---

## 7. Filtering and Editing Requirements

### Filtering Standard

Filters must be:

- Stackable
- Composable
- Represented as one active filter object
- Applied to ledger, totals, and charts
- Shareable through URL state
- Visible as removable chips
- Computed server-side for aggregations and rollups

Filtering must not rely on fetching everything and filtering in the browser.

### Editing Standard

Editing must be:

- Inline
- Optimistic
- Reversible with undo
- Available without modal-heavy workflows

Bulk edit must allow selected rows to change department or category once.

### Traceability Standard

Every derived number must trace back to the rows that produced it.

Every KPI and chart must drill down to the exact ledger rows behind it.

---

## 8. CSV Import Pipeline Requirements

The CSV pipeline must handle messy real-world files.

Required steps:

1. Upload file
2. Detect delimiter, encoding, and header row
3. Map columns to the transaction schema
4. Remember mappings per file shape
5. Validate rows for bad dates, missing amounts, wrong currency, and duplicates
6. Auto-categorise rows using rules and AI suggestions
7. Assign a confidence score
8. Show staging review
9. Flag low-confidence rows for human confirmation
10. Commit approved rows to the ledger
11. Log the import in csv_imports
12. Support audit and reversibility

Critical rule:

Uploading the same file twice must not double the books.

---

## 9. AI Requirements

AI must have a clear job, confidence handling, and human review where money is involved.

| AI Feature | Required Behavior | Guardrail |
| --- | --- | --- |
| Automatic categorisation | Classifies imported rows into category, subcategory, and department | Low confidence rows go to human review |
| Natural language query | Converts questions into existing filters and aggregations | Must not invent numbers |
| Monthly briefing | Summarises real aggregate results in plain English | Every claim must be traceable |
| Anomaly detection | Flags spikes, drops, and unusual transactions | Owner confirms or dismisses |
| Forecasting | Projects MRR, runway, and expense trends | Assumptions must be shown and labelled as projection |
| Receipt / invoice OCR | Converts photo or PDF into draft transaction | Draft only until human confirms |

Core principle:

AI proposes. The human commits anything that touches the books.

---

## 10. Automation Requirements

Automation brain:

- n8n cloud

Required automation areas:

- Recurring generation for retainers and subscriptions
- Calendar population from recurring items
- External sync from Stripe, bank feed, or accounting tool into staging
- Alerts through Slack or email
- Scheduled monthly reporting

Required safety rules:

- Recurring generation must be idempotent
- Missed or replayed runs must not double post
- External synced data must go through validation and categorisation before ledger commit
- Alerts should cover runway below threshold, department over budget, concentration risk, and large unusual expense

---

## 11. Tech Stack and Constraints

Required or expected stack from the brief:

- Database: Supabase Postgres, realtime
- Frontend and deployment: Next.js on Vercel
- Automation: n8n cloud
- AI: Claude API
- Operating currency: AED
- Reporting currency: USD
- Notion and Airtable: mirrors only, never operational database

Alternatives may be justified, but the decision log must explain why.

---

## 12. Phase-by-Phase Build Plan

Phases 1 to 3 are the core MVP foundation. Phase 4 contains the required AI MVP work plus later-phase product scope from the brief, such as Calendar and recurring automation.

## Phase 1: Data Model, Ledger, Manual Entry, Stackable Filters, Inline Editing

### Objective

Build the source of truth and the interaction standard that everything else depends on.

### Build Scope

- Supabase Postgres schema
- Seed departments
- Seed categories and subcategories
- Seed clients
- Seed people where needed for payroll links
- Seed transactions from the sample revenue and expense data
- Ledger tab
- Manual add entry form
- Stackable filters
- Shareable filter state
- Running totals based on active filters
- Inline editing
- Optimistic update
- Undo
- Bulk edit for department and category

### Required Data Work

- Create transactions table
- Create departments table
- Create categories table with parent_id support
- Create clients table
- Create people table
- Store transaction currency and fx_rate
- Store source as manual, CSV, or automation
- Support attachment_url field even if attachments are basic in MVP

### Required UI Work

- Ledger table with required columns
- Filter controls for department, category, type, date range, and client
- Removable filter chips
- Search across description, client, and vendor
- Fast add-entry form
- Inline editable cells
- Row selection
- Bulk edit action

### Acceptance Criteria

- Owner can add a revenue or expense manually
- Owner can filter by multiple fields at once
- Active totals update based on the current filters
- Owner can edit a cell inline
- Owner can undo an edit
- Owner can bulk edit selected rows
- Filtered view can be shared through URL state
- Derived totals come from server-side queries, not browser-only filtering

### Decision Notes to Capture

- Why revenue and expense are stored together or separately
- How filter state is represented
- How undo is handled
- How server-side aggregation is structured
- How categories can change without hardcoding values

---

## Phase 2: Dashboard Charts, KPI Cards, Department Rollups

### Objective

Create the owner's cockpit so the business position is clear in under 60 seconds.

### Build Scope

- Dashboard tab
- KPI cards
- Global date range selector
- Chart catalogue from the brief
- Drill-down from KPIs and charts to filtered ledger rows
- Departments tab
- Department rollups
- Department P&L table

### Required KPI Cards

- Net profit
- Net margin %
- MRR
- Cash runway in months
- Anomaly flag count

Each card must show:

- Value
- Change vs previous period
- Direction

### Required Charts

- Revenue vs expenses over time
- MRR trend with movement
- Revenue by department
- Expense breakdown by category
- Profit margin trend
- Department P&L
- Revenue type split
- Top clients by revenue
- Cash runway
- Budget vs actual by department

### Required Department Rollups

For each department:

- Revenue
- Cost
- Contribution margin
- Headcount
- Budget vs actual
- Trend

### Acceptance Criteria

- Dashboard opens to the owner-level view
- Global date range controls all KPIs and charts
- Each KPI and chart drills down into the ledger
- Department P&L clearly shows which departments make money
- Revenue type split shows one off vs recurring dependence
- Top clients chart includes concentration risk
- Budget vs actual shows overspending risk by department
- Charts answer the nine owner questions, not just total money in and out

### Decision Notes to Capture

- Why each chart type was chosen
- How drill-down maps a chart point to ledger filters
- Which aggregates are SQL views or server-side queries
- How department budget vs actual is calculated

---

## Phase 3: CSV Import Pipeline With Validation and Review

### Objective

Let the owner import messy expense CSVs without corrupting the ledger.

### Build Scope

- CSV upload
- Delimiter, encoding, and header detection
- Column mapping screen
- Saved mapping by file shape
- Row validation
- Duplicate detection
- Auto-categorisation suggestion layer
- Confidence score
- Staging review table
- Human confirmation for low-confidence rows
- Commit approved rows to ledger
- csv_imports audit record
- Import reversibility path

### Required Validation

- Bad dates
- Missing amounts
- Wrong currency
- Obvious duplicates against existing transactions
- Duplicate upload prevention

### Required Review Behavior

- Nothing commits silently
- Low-confidence rows are visibly flagged
- Human confirms or corrects before commit
- Approved rows become ledger transactions
- Import metadata is logged

### Acceptance Criteria

- Owner can upload a messy CSV
- Owner can map columns to the required schema
- Mapping can be remembered for repeat file shapes
- Invalid rows are blocked or flagged before commit
- Duplicate rows are detected
- Uploading the same file twice does not double count transactions
- Import creates a csv_imports audit record
- Imported rows use the same ledger, filters, totals, and dashboard rollups

### Decision Notes to Capture

- Duplicate detection strategy
- Date parsing strategy
- Currency parsing strategy
- How staged rows are separated from committed ledger rows
- How imports can be audited or reversed

---

## Phase 4: AI MVP Features, Calendar, and Recurring Automation

### Objective

Add intelligence and automation while keeping financial control with the human.

For strict MVP scope, the required part of this phase is at least two AI features with confidence and human-in-the-loop handling. Calendar and recurring automation are still in the PRD because the brief includes them, but they can be treated as later-phase implementation if the MVP needs to stay smaller.

### Build Scope

Core MVP scope:

- AI automatic categorisation
- AI natural language query
- Confidence scoring
- Human review for money-impacting changes

Full PRD / later-phase scope:

- Calendar tab
- Recurring item templates
- Recurring transaction generation
- Calendar event generation
- n8n automation design for recurring runs, alerts, sync, and reports

### MVP AI Features

The MVP should include at least:

1. Automatic categorisation
2. Natural language query

These are chosen because they directly support the CSV pipeline, ledger filtering, and dashboard drill-down model.

### AI Categorisation Requirements

- Suggest category
- Suggest subcategory
- Suggest department
- Return confidence score
- Route low-confidence rows to human review
- Never silently commit AI choices to the ledger

### Natural Language Query Requirements

- Convert questions into the existing filter and aggregation layer
- Produce a filtered view or chart
- Avoid inventing numbers
- Keep results traceable to ledger rows

### Calendar Requirements

- Month view
- Upcoming list view
- Payroll dates
- Retainer billing cycles
- Invoices due
- Subscription renewals
- Tax and compliance dates
- Scheduled reviews
- Cash needed in next 30 days
- Links from events to transactions or recurring items

### Recurring Automation Requirements

- Retainers auto-create revenue each cycle
- Subscriptions auto-create expense each cycle
- Generated items must be idempotent
- Missed or replayed runs must not double post
- Recurring items generate calendar events and reminders

### n8n Automation Areas

- Recurring generation
- Calendar population
- External sync into staging
- Slack and email alerts
- Scheduled monthly briefing

### Acceptance Criteria

Core MVP:

- AI can suggest category, subcategory, and department for imported rows
- Confidence is visible
- Low-confidence rows require human confirmation
- Natural language query produces a filtered ledger view or chart using real data

Full PRD / later-phase:

- Calendar shows upcoming financial obligations
- Recurring items can generate calendar events
- Recurring generation has an idempotency strategy
- Automation boundaries are documented clearly

### Decision Notes to Capture

- Why these two AI features were selected first
- How confidence thresholds work
- How AI output is traced back to data
- How idempotency keys or recurrence tracking prevent double posting
- Where automation stops and human approval starts

---

## 13. Seed Data Requirements

The MVP must be built against the provided sample month.

### Sample Revenue

| Date | Description | Amount USD | Type | Department | Category | Client |
| --- | --- | ---: | --- | --- | --- | --- |
| 03 Jun | Build project, lead system | 18000 | Revenue | Development | One off build | Client A |
| 05 Jun | Retainer, June | 4000 | Revenue | Onboarding | Monthly retainer | Client B |
| 05 Jun | Retainer, June | 3500 | Revenue | Onboarding | Monthly retainer | Client C |
| 10 Jun | AI agent subscription | 1200 | Revenue | Development | AI subscription | Client D |
| 15 Jun | Strategy sprint | 6000 | Revenue | Sales | Consulting | Client E |

### Sample Expenses

| Date | Description | Amount USD | Type | Department | Category | Vendor |
| --- | --- | ---: | --- | --- | --- | --- |
| 01 Jun | Engineer salary | 5500 | Expense | Development | Payroll | Internal |
| 01 Jun | Designer salary | 3800 | Expense | Design | Payroll | Internal |
| 02 Jun | Meta ad spend | 4200 | Expense | Marketing | Ad spend | Meta |
| 04 Jun | Automation platform | 120 | Expense | Operations | Software | n8n |
| 04 Jun | Database & hosting | 260 | Expense | Development | Tools | Supabase / Vercel |
| 06 Jun | AI API usage | 740 | Expense | Development | Software | Claude API |
| 12 Jun | Contractor, build | 2400 | Expense | Development | Contractors | Freelancer |
| 20 Jun | Accounting | 600 | Expense | Operations | Professional services | Accountant |

The dashboard should make this story obvious:

- Positive month
- Clear margin
- Heavy development cost base
- Marketing line that can be tested against CAC

---

## 14. Hard-Part Implementation Notes

These are the areas that must be addressed in the decision log.

| Hard Part | Required Approach to Explain |
| --- | --- |
| Aggregation at scale | How MRR, margins, runway, and rollups are computed server-side |
| Stackable filters | How one composable filter object drives ledger, totals, and charts |
| Recurring without double counting | How recurrence modelling and idempotent generation work |
| CSV reality | How messy headers, date formats, encodings, and duplicates are handled |
| Multi currency | How AED entries and USD reporting use stored FX |
| AI with judgement | How confidence, human review, cost, latency, and traceability are handled |
| Editability without breakage | How inline edit and category reassignment avoid corrupting reports |
| Permissions | How owner view and staff view differ |

---

## 15. Core MVP Acceptance Checklist

### Product and UX

- Owner can see business health in under 60 seconds
- Interface prioritises decision-making over bookkeeping
- Main workflows are simple and editable
- Wrong numbers can be fixed quickly without leaving the screen

### Ledger

- Ledger contains revenue and expenses
- Required columns exist
- Manual entry works
- Inline editing works
- Undo works
- Bulk edit works
- Filters stack and compose
- Running totals reflect active filters

### Dashboard

- KPI cards exist with value, change, and direction
- Required charts exist
- Global date range controls dashboard
- Every KPI and chart drills down to ledger rows

### Departments

- Department rollups exist
- Department P&L exists
- Department click-through opens filtered ledger and charts

### Category Settings

- Categories and subcategories are manageable as data
- Revenue and expense categories are supported
- Categorisation rules can be defined
- Recurring item templates can be documented or implemented if included in the chosen MVP scope

### CSV

- Upload works
- Mapping works
- Validation works
- Duplicates are handled
- Staging review exists
- Human confirmation is required before commit
- csv_imports audit trail exists

### AI

- At least two AI features are implemented
- Confidence is shown
- Human-in-the-loop exists for financial changes
- AI results are traceable to real aggregates or ledger rows

### Data Model and Communication

- Data model is documented
- Required schema decisions are defended
- One-page decision log exists
- Skipped items and next steps are clear

---

## 16. Full PRD / Later-Phase Checklist

These items are still indicated in the Notion/MD brief, but they are not part of the minimum MVP delivery unless the team chooses to build a larger MVP.

### People / Team

- Staff and contractor records exist
- People can link to payroll or contractor cost transactions
- Payroll as % of revenue and revenue per head are calculated

### Calendar

- Month view exists
- Upcoming list view exists
- Calendar shows payroll, retainers, invoices due, renewals, tax/compliance dates, and reviews
- Cash needed in the next 30 days is surfaced

### Settings / Integrations

- Currency settings exist
- Fiscal year start exists
- Connected source settings exist
- Notification destinations exist
- Roles and permissions are handled

### Automation

- Recurring generation approach is idempotent
- Calendar population is connected to recurring items
- External sync goes through staging, validation, and categorisation
- Alerts and scheduled reporting are implemented or clearly documented

### Additional AI

- Forecasting shows assumptions and is labelled as projection
- OCR creates draft transactions only
- Monthly briefing is generated from real aggregates and traceable claims

---

## 17. Submission Package

The final submission should include:

- Working deployed build, preferably on Vercel
- Repository link
- Data model note
- One-page decision log
- Short explanation of what was built, what was skipped, and what would come next

The decision log should be written so a future engineer can understand the system cold.

---

## 18. Suggested Build Order Summary

| Order | Phase | Main Outcome |
| --- | --- | --- |
| 1 | Phase 1 | Source of truth ledger, schema, filters, editing |
| 2 | Phase 2 | Owner cockpit, KPI cards, charts, department rollups |
| 3 | Phase 3 | Safe CSV import pipeline with validation and review |
| 4 | Phase 4 | Required AI features plus later-phase calendar and recurring automation plan |

The MVP is successful when the owner can answer the nine decision questions from the brief using live ledger-backed metrics, with every chart and KPI traceable back to the source transactions.
