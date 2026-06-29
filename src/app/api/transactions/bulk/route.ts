import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseBody } from "@/lib/api/validation"
import { bulkUpdateTransactions } from "@/lib/db/mutations/transactions"

const bulkUpdateTransactionsSchema = z.object({
  categoryId: z.uuid(),
  departmentId: z.uuid(),
  ids: z.array(z.uuid()).min(1),
  subcategoryId: z.uuid().nullable().optional(),
})

export async function PATCH(request: Request) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const body = parseBody(bulkUpdateTransactionsSchema, await request.json().catch(() => ({})))
    const transactions = await bulkUpdateTransactions(context, body)

    return success({ transactions })
  } catch (error) {
    return apiError(error)
  }
}
