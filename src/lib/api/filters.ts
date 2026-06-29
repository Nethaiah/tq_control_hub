import { z } from "zod"

export const transactionFilterSchema = z.object({
  categoryId: z.string().optional(),
  clientOrVendor: z.string().optional(),
  from: z.string().optional(),
  departmentId: z.string().optional(),
  ids: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  recurring: z.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["date", "type", "description", "amount", "department", "category", "source", "recurring"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  source: z.enum(["manual", "csv", "automation"]).optional(),
  to: z.string().optional(),
  type: z.enum(["revenue", "expense"]).optional(),
})

export type TransactionFilter = z.infer<typeof transactionFilterSchema>

export const metricsFilterSchema = z.object({
  categoryId: z.string().optional(),
  clientOrVendor: z.string().optional(),
  from: z.string().optional(),
  departmentId: z.string().optional(),
  ids: z.string().optional(),
  search: z.string().optional(),
  source: z.enum(["manual", "csv", "automation"]).optional(),
  to: z.string().optional(),
  type: z.enum(["revenue", "expense"]).optional(),
})

export type MetricsFilter = z.infer<typeof metricsFilterSchema>

export const departmentMetricsFilterSchema = metricsFilterSchema.extend({
  pnlPage: z.coerce.number().int().positive().optional(),
  pnlPageSize: z.coerce.number().int().positive().max(50).optional(),
  pnlSearch: z.string().optional(),
  pnlSortBy: z
    .enum([
      "department",
      "revenueUsd",
      "expenseUsd",
      "contributionMarginUsd",
      "marginPercent",
      "budgetUsedPercent",
    ])
    .optional(),
  pnlSortDir: z.enum(["asc", "desc"]).optional(),
})

export type DepartmentMetricsFilter = z.infer<typeof departmentMetricsFilterSchema>

export const calendarWindowSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export type CalendarWindow = z.infer<typeof calendarWindowSchema>

export function searchParamsToObject(searchParams: URLSearchParams) {
  const values: Record<string, string | string[]> = {}

  searchParams.forEach((value, key) => {
    const current = values[key]

    if (current === undefined) {
      values[key] = value
      return
    }

    values[key] = Array.isArray(current) ? [...current, value] : [current, value]
  })

  return values
}
