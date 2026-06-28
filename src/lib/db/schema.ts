import { sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const currencyEnum = pgEnum("currency", ["USD", "AED"])
export const transactionTypeEnum = pgEnum("transaction_type", ["revenue", "expense"])
export const transactionSourceEnum = pgEnum("transaction_source", ["manual", "csv", "automation"])
export const categoryKindEnum = pgEnum("category_kind", ["revenue", "expense"])
export const clientStatusEnum = pgEnum("client_status", ["active", "paused", "lead"])
export const personTypeEnum = pgEnum("person_type", ["employee", "contractor"])
export const personCadenceEnum = pgEnum("person_cadence", ["monthly", "weekly", "hourly"])
export const personStatusEnum = pgEnum("person_status", ["active", "paused", "offboarded"])
export const recurringCadenceEnum = pgEnum("recurring_cadence", ["monthly", "quarterly", "annual"])
export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "payroll",
  "retainer",
  "invoice_due",
  "renewal",
  "tax",
  "review",
])
export const integrationKindEnum = pgEnum("integration_kind", [
  "payments",
  "bank",
  "accounting",
  "notification",
  "mirror",
])
export const integrationStatusEnum = pgEnum("integration_status", [
  "not_connected",
  "planned",
  "mirror_only",
])
export const csvImportStatusEnum = pgEnum("csv_import_status", [
  "staged",
  "blocked_duplicate",
  "committed",
  "needs_review",
])
export const csvReviewStateEnum = pgEnum("csv_review_state", ["approved", "needs_human", "blocked"])
export const aiFeatureEnum = pgEnum("ai_feature", [
  "categorization",
  "natural_language_query",
  "anomaly",
  "briefing",
  "forecast",
  "ocr",
])
export const aiReviewStateEnum = pgEnum("ai_review_state", [
  "draft",
  "applied",
  "dismissed",
  "needs_human",
])
export const memberRoleEnum = pgEnum("member_role", ["owner", "staff"])
export const memberStatusEnum = pgEnum("member_status", ["active", "invited", "disabled"])

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ...timestamps,
}).enableRLS()

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  ...timestamps,
}).enableRLS()

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull(),
    status: memberStatusEnum("status").default("active").notNull(),
    ...timestamps,
  },
  (table) => [
    index("organization_members_user_org_idx").on(table.userId, table.organizationId),
    uniqueIndex("organization_members_org_user_unique").on(table.organizationId, table.userId),
  ]
).enableRLS()

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    monthlyBudgetUsd: numeric("monthly_budget_usd", { precision: 12, scale: 2, mode: "number" }).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("departments_org_idx").on(table.organizationId)]
).enableRLS()

export const memberDepartmentAccess = pgTable(
  "member_department_access",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.memberId, table.departmentId] }),
    index("member_department_access_department_idx").on(table.departmentId),
  ]
).enableRLS()

export const departmentBudgets = pgTable(
  "department_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    budgetUsd: numeric("budget_usd", { precision: 12, scale: 2, mode: "number" }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("department_budgets_org_department_idx").on(table.organizationId, table.departmentId),
    uniqueIndex("department_budgets_department_period_unique").on(table.departmentId, table.periodStart),
  ]
).enableRLS()

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: categoryKindEnum("kind").notNull(),
    parentId: uuid("parent_id").references((): any => categories.id, { onDelete: "set null" }),
    archived: boolean("archived").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    index("categories_org_parent_idx").on(table.organizationId, table.parentId),
    index("categories_org_kind_idx").on(table.organizationId, table.kind),
  ]
).enableRLS()

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: clientStatusEnum("status").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    mrrUsd: numeric("mrr_usd", { precision: 12, scale: 2, mode: "number" }).notNull(),
    ...timestamps,
  },
  (table) => [index("clients_org_status_idx").on(table.organizationId, table.status)]
).enableRLS()

export const people = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    type: personTypeEnum("type").notNull(),
    costUsd: numeric("cost_usd", { precision: 12, scale: 2, mode: "number" }).notNull(),
    cadence: personCadenceEnum("cadence").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    status: personStatusEnum("status").notNull(),
    payrollSensitive: boolean("payroll_sensitive").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("people_org_department_status_idx").on(table.organizationId, table.departmentId, table.status)]
).enableRLS()

export const recurringItems = pgTable(
  "recurring_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
    currency: currencyEnum("currency").notNull(),
    fxRateToUsd: numeric("fx_rate_to_usd", { precision: 12, scale: 6, mode: "number" }).notNull(),
    cadence: recurringCadenceEnum("cadence").notNull(),
    nextRun: date("next_run", { mode: "string" }).notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    subcategoryId: uuid("subcategory_id").references(() => categories.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    vendor: text("vendor"),
    template: text("template").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index("recurring_items_org_next_run_idx").on(table.organizationId, table.nextRun),
    uniqueIndex("recurring_items_org_idempotency_key_unique").on(table.organizationId, table.idempotencyKey),
  ]
).enableRLS()

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
    currency: currencyEnum("currency").notNull(),
    fxRateToUsd: numeric("fx_rate_to_usd", { precision: 12, scale: 6, mode: "number" }).notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    subcategoryId: uuid("subcategory_id").references(() => categories.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    vendor: text("vendor"),
    recurring: boolean("recurring").default(false).notNull(),
    recurrenceId: uuid("recurrence_id").references(() => recurringItems.id, { onDelete: "set null" }),
    source: transactionSourceEnum("source").notNull(),
    attachmentUrl: text("attachment_url"),
    createdBy: text("created_by").notNull(),
    status: text("status").default("active").notNull(),
    ...timestamps,
  },
  (table) => [
    index("transactions_org_date_idx").on(table.organizationId, table.date),
    index("transactions_org_type_date_idx").on(table.organizationId, table.type, table.date),
    index("transactions_org_department_date_idx").on(table.organizationId, table.departmentId, table.date),
    index("transactions_org_category_date_idx").on(table.organizationId, table.categoryId, table.date),
    index("transactions_org_client_date_idx").on(table.organizationId, table.clientId, table.date),
    index("transactions_org_source_date_idx").on(table.organizationId, table.source, table.date),
    index("transactions_org_recurring_date_idx").on(table.organizationId, table.recurring, table.date),
  ]
).enableRLS()

export const personTransactions = pgTable(
  "person_transactions",
  {
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.personId, table.transactionId] })]
).enableRLS()

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    type: calendarEventTypeEnum("type").notNull(),
    amountUsd: numeric("amount_usd", { precision: 14, scale: 2, mode: "number" }).notNull(),
    transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    recurringItemId: uuid("recurring_item_id").references(() => recurringItems.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("calendar_events_org_date_idx").on(table.organizationId, table.date)]
).enableRLS()

export const appSettings = pgTable("app_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  operatingCurrency: currencyEnum("operating_currency").notNull(),
  reportingCurrency: currencyEnum("reporting_currency").notNull(),
  fiscalYearStartMonth: text("fiscal_year_start_month").notNull(),
  timezone: text("timezone").notNull(),
  approvalPolicy: text("approval_policy").notNull(),
  ...timestamps,
}).enableRLS()

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: integrationKindEnum("kind").notNull(),
    status: integrationStatusEnum("status").notNull(),
    destination: text("destination").notNull(),
    stagingRequired: boolean("staging_required").default(true).notNull(),
    commitPolicy: text("commit_policy").notNull(),
    notes: text("notes").notNull(),
    ...timestamps,
  },
  (table) => [index("integration_connections_org_kind_idx").on(table.organizationId, table.kind)]
).enableRLS()

export const permissionRoles = pgTable("permission_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scope: text("scope").notNull(),
  permissions: jsonb("permissions").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  ...timestamps,
}).enableRLS()

export const csvImports = pgTable(
  "csv_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    fileHash: text("file_hash").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull(),
    rowCount: integer("row_count").notNull(),
    status: csvImportStatusEnum("status").notNull(),
    delimiter: text("delimiter").notNull(),
    encoding: text("encoding").notNull(),
    headerRow: integer("header_row").notNull(),
    columnMapping: jsonb("column_mapping").$type<Record<string, string>>().default(sql`'{}'::jsonb`).notNull(),
    duplicateOfImportId: uuid("duplicate_of_import_id").references((): any => csvImports.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("csv_imports_org_file_hash_idx").on(table.organizationId, table.fileHash)]
).enableRLS()

export const csvStagedRows = pgTable(
  "csv_staged_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importId: uuid("import_id")
      .notNull()
      .references(() => csvImports.id, { onDelete: "cascade" }),
    rawDate: text("raw_date").notNull(),
    rawDescription: text("raw_description").notNull(),
    rawAmount: text("raw_amount").notNull(),
    parsedDate: date("parsed_date", { mode: "string" }),
    parsedAmount: numeric("parsed_amount", { precision: 14, scale: 2, mode: "number" }),
    currency: currencyEnum("currency"),
    duplicate: boolean("duplicate").default(false).notNull(),
    validationIssues: jsonb("validation_issues").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    suggestedDepartmentId: uuid("suggested_department_id").references(() => departments.id, { onDelete: "set null" }),
    suggestedCategoryId: uuid("suggested_category_id").references(() => categories.id, { onDelete: "set null" }),
    suggestedSubcategoryId: uuid("suggested_subcategory_id").references(() => categories.id, { onDelete: "set null" }),
    confidence: numeric("confidence", { precision: 5, scale: 4, mode: "number" }).notNull(),
    reviewState: csvReviewStateEnum("review_state").notNull(),
    ...timestamps,
  },
  (table) => [index("csv_staged_rows_import_review_state_idx").on(table.importId, table.reviewState)]
).enableRLS()

export const aiSuggestions = pgTable("ai_suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  feature: aiFeatureEnum("feature").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4, mode: "number" }).notNull(),
  reviewState: aiReviewStateEnum("review_state").notNull(),
  transactionIds: jsonb("transaction_ids").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  filterQuery: text("filter_query"),
  proposedAction: text("proposed_action").notNull(),
  ...timestamps,
}).enableRLS()

export const transactionRevisions = pgTable("transaction_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  before: jsonb("before").$type<Record<string, unknown>>().notNull(),
  after: jsonb("after").$type<Record<string, unknown>>().notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS()

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS()

export const recurringRuns = pgTable(
  "recurring_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recurringItemId: uuid("recurring_item_id")
      .notNull()
      .references(() => recurringItems.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("recurring_runs_org_idempotency_key_unique").on(table.organizationId, table.idempotencyKey)]
).enableRLS()

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  ...timestamps,
}).enableRLS()

export const csvMappingRules = pgTable(
  "csv_mapping_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fileSignature: text("file_signature").notNull(),
    columnMapping: jsonb("column_mapping").$type<Record<string, string>>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("csv_mapping_rules_org_signature_unique").on(table.organizationId, table.fileSignature)]
).enableRLS()
