import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { transactionFilterSchema, searchParamsToObject } from "@/lib/api/filters"
import { requireMembership, requireOwner } from "@/lib/api/permissions"
import { apiError, created, success } from "@/lib/api/responses"
import { parseBody, parseQuery } from "@/lib/api/validation"
import { createTransaction } from "@/lib/db/mutations/transactions"
import { listLedgerData } from "@/lib/db/queries/transactions"

const createTransactionSchema = z.object({
  amount: z.coerce.number().positive(),
  attachmentUrl: z.string().trim().min(1).nullable().optional(),
  categoryId: z.uuid(),
  clientId: z.uuid().nullable().optional(),
  currency: z.enum(["USD", "AED"]),
  date: z.string().min(1),
  departmentId: z.uuid(),
  description: z.string().trim().min(3),
  fxRateToUsd: z.coerce.number().positive().optional(),
  recurring: z.boolean().optional(),
  source: z.enum(["manual", "csv", "automation"]).optional(),
  subcategoryId: z.uuid().nullable().optional(),
  type: z.enum(["revenue", "expense"]),
  vendor: z.string().trim().min(1).nullable().optional(),
})

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const filters = parseQuery(
      transactionFilterSchema,
      searchParamsToObject(new URL(request.url).searchParams)
    )
    const data = await listLedgerData(context, filters)

    return success(data)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const body = parseBody(createTransactionSchema, await request.json().catch(() => ({})))
    const transaction = await createTransaction(context, body)

    return created({ transaction })
  } catch (error) {
    return apiError(error)
  }
}
