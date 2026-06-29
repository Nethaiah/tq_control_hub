import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseBody, parseQuery } from "@/lib/api/validation"
import { updateRecurringItem } from "@/lib/db/mutations/recurring-items"

const paramsSchema = z.object({
  id: z.uuid(),
})

const updateRecurringItemSchema = z.object({
  active: z.boolean().optional(),
  amount: z.coerce.number().positive().optional(),
  cadence: z.enum(["monthly", "quarterly", "annual"]).optional(),
  categoryId: z.uuid().optional(),
  clientId: z.uuid().nullable().optional(),
  currency: z.enum(["USD", "AED"]).optional(),
  departmentId: z.uuid().optional(),
  fxRateToUsd: z.coerce.number().positive().optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
  nextRun: z.string().min(1).optional(),
  subcategoryId: z.uuid().nullable().optional(),
  template: z.string().trim().min(3).optional(),
  type: z.enum(["revenue", "expense"]).optional(),
  vendor: z.string().trim().min(1).nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const { id } = parseQuery(paramsSchema, await params)
    const body = parseBody(updateRecurringItemSchema, await request.json().catch(() => ({})))
    const recurringItem = await updateRecurringItem(context, id, body)

    return success({ recurringItem })
  } catch (error) {
    return apiError(error)
  }
}
