import { z } from "zod"

export const transactionFilterSchema = z.object({
  categoryId: z.string().optional(),
  clientId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  departmentId: z.string().optional(),
  ids: z.array(z.string()).optional(),
  recurring: z.boolean().optional(),
  search: z.string().optional(),
  source: z.string().optional(),
  type: z.enum(["revenue", "expense"]).optional(),
})

export type TransactionFilter = z.infer<typeof transactionFilterSchema>

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
