import { requireAuthContext } from "@/lib/api/auth"
import { departmentMetricsFilterSchema, searchParamsToObject } from "@/lib/api/filters"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseQuery } from "@/lib/api/validation"
import { getDepartmentRollups } from "@/lib/db/queries/metrics"

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const query = parseQuery(
      departmentMetricsFilterSchema,
      searchParamsToObject(new URL(request.url).searchParams)
    )
    const {
      pnlPage,
      pnlPageSize,
      pnlSearch,
      pnlSortBy,
      pnlSortDir,
      ...filters
    } = query
    const data = await getDepartmentRollups(context, filters, {
      page: pnlPage,
      pageSize: pnlPageSize,
      search: pnlSearch,
      sortBy: pnlSortBy,
      sortDir: pnlSortDir,
    })

    return success(data)
  } catch (error) {
    return apiError(error)
  }
}
