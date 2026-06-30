"use client"

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"

import { OwnerDashboard } from "@/features/dashboard/components/owner-dashboard"
import { filtersToQuery, readApiResponse } from "@/features/metrics/api-client"
import { useUrlFilters } from "@/hooks/use-url-filters"
import type { DashboardMetrics } from "@/domain/metrics"

async function fetchDashboardMetrics(filters: ReturnType<typeof useUrlFilters>["filters"]) {
  const response = await fetch(`/api/metrics/dashboard${filtersToQuery(filters)}`, {
    credentials: "same-origin",
  })
  return readApiResponse<DashboardMetrics>(response, "Unable to load dashboard metrics")
}

export function DashboardWorkspace() {
  const { filters } = useUrlFilters()
  const queryClient = useQueryClient()
  const query = useSuspenseQuery({
    queryFn: () => fetchDashboardMetrics(filters),
    queryKey: ["metrics", "dashboard", filters],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  async function refreshDashboard() {
    await queryClient.invalidateQueries({ queryKey: ["metrics"] })
    await queryClient.refetchQueries({ queryKey: ["metrics"], type: "active" })
  }

  return <OwnerDashboard isRefreshing={query.isFetching} metrics={query.data} onRefresh={refreshDashboard} />
}
