import type { z } from "zod"

import type {
  aiQueryFormSchema,
  aiSuggestionSchema,
  appSettingsSchema,
  calendarEventSchema,
  categoryFormSchema,
  categorySchema,
  clientSchema,
  csvImportSchema,
  csvMappingFormSchema,
  csvStagedRowSchema,
  departmentSchema,
  integrationSchema,
  manualTransactionFormSchema,
  personSchema,
  permissionRoleSchema,
  recurringItemSchema,
  transactionFiltersSchema,
  transactionSchema,
} from "@/domain/schemas"

export type Department = z.infer<typeof departmentSchema>
export type Category = z.infer<typeof categorySchema>
export type Client = z.infer<typeof clientSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type Person = z.infer<typeof personSchema>
export type RecurringItem = z.infer<typeof recurringItemSchema>
export type CalendarEvent = z.infer<typeof calendarEventSchema>
export type AppSettings = z.infer<typeof appSettingsSchema>
export type Integration = z.infer<typeof integrationSchema>
export type PermissionRole = z.infer<typeof permissionRoleSchema>
export type CsvImport = z.infer<typeof csvImportSchema>
export type CsvStagedRow = z.infer<typeof csvStagedRowSchema>
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>
export type ManualTransactionFormValues = z.infer<
  typeof manualTransactionFormSchema
>
export type CategoryFormValues = z.infer<typeof categoryFormSchema>
export type CsvMappingFormValues = z.infer<typeof csvMappingFormSchema>
export type AiQueryFormValues = z.infer<typeof aiQueryFormSchema>

export type Currency = Transaction["currency"]
export type TransactionType = Transaction["type"]

export type TransactionLookups = {
  departments: Department[]
  categories: Category[]
  clients: Client[]
}

export type MetricTrace = {
  transactionIds: string[]
  filters: TransactionFilters
}

export type KpiMetric = {
  label: string
  value: string
  numericValue: number
  changeLabel: string
  direction: "up" | "down" | "flat"
  trace: MetricTrace
}
