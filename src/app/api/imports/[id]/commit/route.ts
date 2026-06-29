import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseQuery } from "@/lib/api/validation"
import { commitImport } from "@/lib/db/mutations/imports"

const paramsSchema = z.object({
  id: z.uuid(),
})

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const { id } = parseQuery(paramsSchema, await params)
    const result = await commitImport(context, id)

    return success(result)
  } catch (error) {
    return apiError(error)
  }
}
