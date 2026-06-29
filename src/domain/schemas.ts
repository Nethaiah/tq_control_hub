import { z } from "zod"

export const currencySchema = z.enum(["USD", "AED"])
export const transactionTypeSchema = z.enum(["revenue", "expense"])
export const transactionSourceSchema = z.enum(["manual", "csv", "automation"])
export const categoryKindSchema = z.enum(["revenue", "expense"])

export const departmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  monthlyBudgetUsd: z.number().nonnegative(),
})

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: categoryKindSchema,
  parentId: z.string().nullable(),
  archived: z.boolean().default(false),
})

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "paused", "lead"]),
  startDate: z.string(),
  mrrUsd: z.number().nonnegative(),
})

export const transactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: transactionTypeSchema,
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: currencySchema,
  fxRateToUsd: z.number().positive(),
  departmentId: z.string(),
  categoryId: z.string(),
  subcategoryId: z.string().nullable(),
  clientId: z.string().nullable(),
  vendor: z.string().nullable(),
  recurring: z.boolean(),
  recurrenceId: z.string().nullable(),
  source: transactionSourceSchema,
  attachmentUrl: z.string().nullable(),
  createdBy: z.string(),
})

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  departmentId: z.string(),
  role: z.string(),
  type: z.enum(["employee", "contractor"]),
  costUsd: z.number().nonnegative(),
  cadence: z.enum(["monthly", "weekly", "hourly"]),
  startDate: z.string(),
  status: z.enum(["active", "paused", "offboarded"]),
  transactionIds: z.array(z.string()).default([]),
})

export const recurringItemSchema = z.object({
  id: z.string(),
  type: transactionTypeSchema,
  amount: z.number().positive(),
  currency: currencySchema,
  fxRateToUsd: z.number().positive(),
  cadence: z.enum(["monthly", "quarterly", "annual"]),
  nextRun: z.string(),
  departmentId: z.string(),
  categoryId: z.string(),
  subcategoryId: z.string().nullable(),
  clientId: z.string().nullable(),
  vendor: z.string().nullable(),
  template: z.string(),
  idempotencyKey: z.string(),
})

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  type: z.enum([
    "payroll",
    "retainer",
    "invoice_due",
    "renewal",
    "tax",
    "review",
  ]),
  amountUsd: z.number().nonnegative(),
  transactionId: z.string().nullable(),
  recurringItemId: z.string().nullable(),
})

export const appSettingsSchema = z.object({
  operatingCurrency: currencySchema,
  reportingCurrency: currencySchema,
  fiscalYearStartMonth: z.string(),
  timezone: z.string(),
  approvalPolicy: z.string(),
})

export const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["payments", "bank", "accounting", "notification", "mirror"]),
  status: z.enum(["not_connected", "planned", "mirror_only"]),
  destination: z.string(),
  stagingRequired: z.boolean(),
  commitPolicy: z.string(),
  notes: z.string(),
})

export const permissionRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.string(),
  permissions: z.array(z.string()),
})

export const csvImportSchema = z.object({
  id: z.string(),
  filename: z.string(),
  fileHash: z.string(),
  uploadedAt: z.string(),
  rowCount: z.number().int().nonnegative(),
  status: z.enum(["staged", "blocked_duplicate", "committed", "needs_review"]),
  delimiter: z.string(),
  encoding: z.string(),
  headerRow: z.number().int().positive(),
  columnMapping: z.record(z.string(), z.string()),
  duplicateOfImportId: z.string().nullable(),
})

export const csvStagedRowSchema = z.object({
  id: z.string(),
  importId: z.string(),
  rawDate: z.string(),
  rawDescription: z.string(),
  rawAmount: z.string(),
  parsedDate: z.string().nullable(),
  parsedAmount: z.number().nullable(),
  currency: currencySchema.nullable(),
  duplicate: z.boolean(),
  validationIssues: z.array(z.string()),
  suggestedDepartmentId: z.string().nullable(),
  suggestedCategoryId: z.string().nullable(),
  suggestedSubcategoryId: z.string().nullable(),
  suggestionModel: z.string().nullable(),
  suggestionSource: z.enum(["keyword", "openrouter", "manual"]),
  confidence: z.number().min(0).max(1),
  reviewState: z.enum(["approved", "needs_human", "blocked"]),
})

export const aiSuggestionSchema = z.object({
  id: z.string(),
  feature: z.enum([
    "categorization",
    "natural_language_query",
    "anomaly",
    "briefing",
    "forecast",
    "ocr",
  ]),
  title: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  reviewState: z.enum(["draft", "applied", "dismissed", "needs_human"]),
  transactionIds: z.array(z.string()),
  filterQuery: z.string().nullable(),
  proposedAction: z.string(),
})

export const transactionFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: transactionTypeSchema.optional(),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  clientOrVendor: z.string().optional(),
  search: z.string().optional(),
  source: transactionSourceSchema.optional(),
  ids: z.string().optional(),
})

export const manualTransactionFormSchema = z.object({
  date: z.string().min(1, "Choose a date"),
  type: transactionTypeSchema,
  description: z.string().min(3, "Describe the transaction"),
  amount: z.coerce.number().positive("Enter an amount above zero"),
  currency: currencySchema,
  departmentId: z.string().min(1, "Choose a department"),
  categoryId: z.string().min(1, "Choose a category"),
  subcategoryId: z.string().optional(),
  clientId: z.string().optional(),
  vendor: z.string().optional(),
})

export const categoryFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  kind: categoryKindSchema,
  parentId: z.string().optional(),
})

export const csvMappingFormSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().min(1),
})

export const aiQueryFormSchema = z.object({
  question: z.string().min(8, "Ask a specific owner question"),
})
