import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseBody, parseQuery } from "@/lib/api/validation"
import { updateStagedRow } from "@/lib/db/mutations/imports"

const paramsSchema = z.object({
  id: z.uuid(),
  rowId: z.uuid(),
})

const updateStagedRowSchema = z.object({
  currency: z.enum(["USD", "AED"]).nullable().optional(),
  duplicate: z.boolean().optional(),
  parsedAmount: z.coerce.number().positive().nullable().optional(),
  parsedDate: z.string().min(1).nullable().optional(),
  reviewState: z.enum(["approved", "needs_human", "blocked"]).optional(),
  suggestedCategoryId: z.uuid().nullable().optional(),
  suggestedDepartmentId: z.uuid().nullable().optional(),
  suggestedSubcategoryId: z.uuid().nullable().optional(),
  validationIssues: z.array(z.string()).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const { id, rowId } = parseQuery(paramsSchema, await params)
    const body = parseBody(updateStagedRowSchema, await request.json().catch(() => ({})))
    const stagedRow = await updateStagedRow(context, id, rowId, body)

    return success({ stagedRow })
  } catch (error) {
    return apiError(error)
  }
}
