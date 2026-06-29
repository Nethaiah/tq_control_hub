"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"

import { OwnerDashboard } from "@/features/dashboard/components/owner-dashboard"
import { filtersToQuery, readApiResponse } from "@/features/metrics/api-client"
import { MetricsError, MetricsLoading } from "@/features/metrics/components/metrics-state"
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
  const query = useQuery({
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

  if (query.isPending) {
    return (
      <MetricsLoading
        description="Owner cockpit covering net profit, MRR, runway, department P&L, and ledger-backed signals."
        title="Owner cockpit"
      />
    )
  }

  if (query.isError || !query.data) {
    return (
      <MetricsError
        description="Owner cockpit covering net profit, MRR, runway, department P&L, and ledger-backed signals."
        message={query.error instanceof Error ? query.error.message : "Unable to load dashboard metrics."}
        title="Owner cockpit"
      />
    )
  }

  return <OwnerDashboard isRefreshing={query.isFetching} metrics={query.data} onRefresh={refreshDashboard} />
}
