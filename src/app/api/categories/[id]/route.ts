import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseBody, parseQuery } from "@/lib/api/validation"
import { updateCategory } from "@/lib/db/mutations/categories"

const paramsSchema = z.object({
  id: z.uuid(),
})

const updateCategorySchema = z.object({
  archived: z.boolean().optional(),
  name: z.string().trim().min(2).optional(),
  parentId: z.uuid().nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const { id } = parseQuery(paramsSchema, await params)
    const body = parseBody(updateCategorySchema, await request.json().catch(() => ({})))
    const category = await updateCategory(context, id, body)

    return success({ category })
  } catch (error) {
    return apiError(error)
  }
}
