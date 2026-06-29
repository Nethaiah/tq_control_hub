import { requireAuthContext } from "@/lib/api/auth"
import { calendarWindowSchema, searchParamsToObject } from "@/lib/api/filters"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseQuery } from "@/lib/api/validation"
import { getCalendarMetrics } from "@/lib/db/queries/metrics"

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const window = parseQuery(
      calendarWindowSchema,
      searchParamsToObject(new URL(request.url).searchParams)
    )
    const metrics = await getCalendarMetrics(context, window.startDate, window.endDate)

    return success(metrics)
  } catch (error) {
    return apiError(error)
  }
}