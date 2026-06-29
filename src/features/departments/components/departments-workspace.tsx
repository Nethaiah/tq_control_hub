"use client"

import { useQuery } from "@tanstack/react-query"

import { DepartmentsOverview } from "@/features/departments/components/departments-overview"
import { filtersToQuery, readApiResponse } from "@/features/metrics/api-client"
import { MetricsError, MetricsLoading } from "@/features/metrics/components/metrics-state"
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
  const query = useQuery({
    queryFn: () => fetchDepartmentRollups(filters),
    queryKey: ["metrics", "departments", filters],
    staleTime: 60_000,
  })

  if (query.isPending) {
    return (
      <MetricsLoading
        description="Each department is treated as its own mini business with revenue, cost, contribution margin, headcount, and budget usage."
        title="Departments"
      />
    )
  }

  if (query.isError || !query.data) {
    return (
      <MetricsError
        description="Each department is treated as its own mini business with revenue, cost, contribution margin, headcount, and budget usage."
        message={query.error instanceof Error ? query.error.message : "Unable to load department metrics."}
        title="Departments"
      />
    )
  }

  return <DepartmentsOverview rollups={query.data.rollups} filters={filters} />
}
