"use client"

import { useSuspenseQuery } from "@tanstack/react-query"

import { DepartmentsOverview } from "@/features/departments/components/departments-overview"
import { filtersToQuery, readApiResponse } from "@/features/metrics/api-client"
import { useUrlFilters } from "@/hooks/use-url-filters"
import type { DepartmentRollup } from "@/domain/metrics"

async function fetchDepartmentRollups(filters: ReturnType<typeof useUrlFilters>["filters"]) {
  const response = await fetch(`/api/metrics/departments${filtersToQuery(filters)}`, {
    credentials: "same-origin",
  })
  return readApiResponse<{ rollups: DepartmentRollup[] }>(
    response,
    "Unable to load department metrics"
  )
}

export function DepartmentsWorkspace() {
  const { filters } = useUrlFilters()
  const query = useSuspenseQuery({
    queryFn: () => fetchDepartmentRollups(filters),
    queryKey: ["metrics", "departments", filters],
    staleTime: 60_000,
  })

  return <DepartmentsOverview rollups={query.data.rollups} filters={filters} />
}
