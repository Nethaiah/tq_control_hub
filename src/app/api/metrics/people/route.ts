import { requireAuthContext } from "@/lib/api/auth"
import { peopleMetricsFilterSchema, searchParamsToObject } from "@/lib/api/filters"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseQuery } from "@/lib/api/validation"
import { getPeopleMetrics } from "@/lib/db/queries/metrics"

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const query = parseQuery(
      peopleMetricsFilterSchema,
      searchParamsToObject(new URL(request.url).searchParams)
    )
    const {
      peoplePage,
      peoplePageSize,
      peopleSearch,
      peopleSortBy,
      peopleSortDir,
      ...filters
    } = query
    const data = await getPeopleMetrics(context, filters, {
      page: peoplePage,
      pageSize: peoplePageSize,
      search: peopleSearch,
      sortBy: peopleSortBy,
      sortDir: peopleSortDir,
    })

    return success(data)
  } catch (error) {
    return apiError(error)
  }
}
