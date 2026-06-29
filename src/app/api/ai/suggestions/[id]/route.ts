import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseBody } from "@/lib/api/validation"
import { updateAiSuggestionReviewState } from "@/lib/db/mutations/ai"

const paramsSchema = z.object({ id: z.uuid() })
const updateSuggestionSchema = z.object({
  reviewState: z.enum(["draft", "applied", "dismissed", "needs_human"]),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const { id } = paramsSchema.parse(await params)
    const body = parseBody(updateSuggestionSchema, await request.json().catch(() => ({})))
    const suggestion = await updateAiSuggestionReviewState(context, id, body.reviewState)

    return success({ suggestion })
  } catch (error) {
    return apiError(error)
  }
}
