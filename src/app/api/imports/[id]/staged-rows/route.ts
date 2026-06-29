import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseQuery } from "@/lib/api/validation"
import { listStagedRows } from "@/lib/db/queries/imports"

const paramsSchema = z.object({
  id: z.uuid(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const { id } = parseQuery(paramsSchema, await params)
    const stagedRows = await listStagedRows(context.organization.id, id)

    return success({ stagedRows })
  } catch (error) {
    return apiError(error)
  }
}
