import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { requireMembership, requireOwner } from "@/lib/api/permissions"
import { apiError, created, success } from "@/lib/api/responses"
import { parseBody } from "@/lib/api/validation"
import { createCategory } from "@/lib/db/mutations/categories"
import { listCategories } from "@/lib/db/queries/categories"

const createCategorySchema = z.object({
  kind: z.enum(["revenue", "expense"]),
  name: z.string().trim().min(2),
  parentId: z.uuid().nullable().optional(),
})

export async function GET() {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const categories = await listCategories(context.organization.id)

    return success({ categories })
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const body = parseBody(createCategorySchema, await request.json().catch(() => ({})))
    const category = await createCategory(context, body)

    return created({ category })
  } catch (error) {
    return apiError(error)
  }
}
