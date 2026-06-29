import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { searchParamsToObject } from "@/lib/api/filters"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseQuery } from "@/lib/api/validation"
import { listStagedRowsData } from "@/lib/db/queries/imports"

const paramsSchema = z.object({
  id: z.uuid(),
})

const stagedRowsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  reviewState: z.enum(["approved", "needs_human", "blocked"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["rawDate", "rawDescription", "rawAmount", "suggestion", "confidence", "suggestionSource", "validation", "reviewState"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const { id } = parseQuery(paramsSchema, await params)
    const query = parseQuery(
      stagedRowsQuerySchema,
      searchParamsToObject(new URL(request.url).searchParams)
    )
    const data = await listStagedRowsData(context.organization.id, id, query)

    return success(data)
  } catch (error) {
    return apiError(error)
  }
}
