import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { searchParamsToObject } from "@/lib/api/filters"
import { requireMembership, requireOwner } from "@/lib/api/permissions"
import { apiError, created, success } from "@/lib/api/responses"
import { parseBody, parseQuery } from "@/lib/api/validation"
import { createRecurringItem } from "@/lib/db/mutations/recurring-items"
import { listRecurringItemsData } from "@/lib/db/queries/recurring-items"

const createRecurringItemSchema = z.object({
  amount: z.coerce.number().positive(),
  cadence: z.enum(["monthly", "quarterly", "annual"]),
  categoryId: z.uuid(),
  clientId: z.uuid().nullable().optional(),
  currency: z.enum(["USD", "AED"]),
  departmentId: z.uuid(),
  fxRateToUsd: z.coerce.number().positive().optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
  nextRun: z.string().min(1),
  subcategoryId: z.uuid().nullable().optional(),
  template: z.string().trim().min(3),
  type: z.enum(["revenue", "expense"]),
  vendor: z.string().trim().min(1).nullable().optional(),
})

const recurringItemsQuerySchema = z.object({
  categoryId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(5),
  search: z.string().optional(),
  sortBy: z.enum(["template", "amount", "classification", "schedule"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  type: z.enum(["revenue", "expense"]).optional(),
})

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const query = parseQuery(
      recurringItemsQuerySchema,
      searchParamsToObject(new URL(request.url).searchParams)
    )
    const data = await listRecurringItemsData(context, query)

    return success(data)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const body = parseBody(createRecurringItemSchema, await request.json().catch(() => ({})))
    const recurringItem = await createRecurringItem(context, body)

    return created({ recurringItem })
  } catch (error) {
    return apiError(error)
  }
}
