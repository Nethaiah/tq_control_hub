import { requireAuthContext } from "@/lib/api/auth"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { listAiSuggestions } from "@/lib/db/queries/ai"

export async function GET() {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const suggestions = await listAiSuggestions(context)
    return success({ suggestions })
  } catch (error) {
    return apiError(error)
  }
}
