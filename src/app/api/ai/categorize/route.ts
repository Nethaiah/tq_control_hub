import { z } from "zod"

import { categorizeRowsWithOpenRouter } from "@/lib/ai/openrouter"
import { requireAuthContext } from "@/lib/api/auth"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, created } from "@/lib/api/responses"
import { parseBody } from "@/lib/api/validation"
import { createAiSuggestion } from "@/lib/db/mutations/ai"
import { loadAiQueryLookups } from "@/lib/db/queries/ai"

const categorizeSchema = z.object({
  rows: z.array(z.object({
    amount: z.coerce.number().nullable().optional(),
    currency: z.enum(["USD", "AED"]).nullable().optional(),
    description: z.string().trim().min(1),
    rawDate: z.string().nullable().optional(),
  })).min(1).max(50),
})

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const body = parseBody(categorizeSchema, await request.json().catch(() => ({})))
    const lookups = await loadAiQueryLookups(context)
    const results = await categorizeRowsWithOpenRouter(body.rows, lookups)
    const averageConfidence = results.reduce((total, item) => total + (item.confidence ?? 0), 0) / results.length
    const needsHuman = results.some((item) => !item.categoryId || !item.departmentId || (item.confidence ?? 0) < 0.85)
    const suggestion = await createAiSuggestion(context, {
      confidence: averageConfidence,
      feature: "categorization",
      proposedAction: JSON.stringify(results),
      reviewState: needsHuman ? "needs_human" : "draft",
      summary: `${results.length} row${results.length === 1 ? "" : "s"} categorized. ${needsHuman ? "At least one row needs human review." : "All rows have high-confidence suggestions."}`,
      title: "Categorization suggestions ready",
      transactionIds: [],
    })

    return created({ results, suggestion })
  } catch (error) {
    return apiError(error)
  }
}
