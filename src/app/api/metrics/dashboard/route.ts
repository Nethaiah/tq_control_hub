import { requireAuthContext } from "@/lib/api/auth"
import { metricsFilterSchema, searchParamsToObject } from "@/lib/api/filters"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseQuery } from "@/lib/api/validation"
import { getDashboardMetrics } from "@/lib/db/queries/metrics"

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const filters = parseQuery(
      metricsFilterSchema,
      searchParamsToObject(new URL(request.url).searchParams)
    )
    const metrics = await getDashboardMetrics(context, filters)

    return success(metrics)
  } catch (error) {
    return apiError(error)
  }
}