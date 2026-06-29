"use client"

import { useQuery } from "@tanstack/react-query"

import { PeopleOverview } from "@/features/people/components/people-overview"
import { filtersToQuery, readApiResponse } from "@/features/metrics/api-client"
import { MetricsError, MetricsLoading } from "@/features/metrics/components/metrics-state"
import { useUrlFilters } from "@/hooks/use-url-filters"
import type { PeopleMetrics } from "@/domain/metrics"
import type { Department, Person, Transaction } from "@/domain/types"

type PeopleMetricsResponse = {
  people: Person[]
  departments: Department[]
  transactions: Transaction[]
  metrics: PeopleMetrics
}

async function fetchPeopleMetrics(filters: ReturnType<typeof useUrlFilters>["filters"]) {
  const response = await fetch(`/api/metrics/people${filtersToQuery(filters)}`, {
    credentials: "same-origin",
  })
  return readApiResponse<PeopleMetricsResponse>(response, "Unable to load people metrics")
}

export function PeopleWorkspace() {
  const { filters } = useUrlFilters()
  const query = useQuery({
    queryFn: () => fetchPeopleMetrics(filters),
    queryKey: ["metrics", "people", filters],
    staleTime: 60_000,
  })

  if (query.isPending) {
    return (
      <MetricsLoading
        description="People costs, payroll pressure, and headcount by department. Linked payroll rows flow into the same ledger-backed P&L."
        title="People / Team"
      />
    )
  }

  if (query.isError || !query.data) {
    return (
      <MetricsError
        description="People costs, payroll pressure, and headcount by department. Linked payroll rows flow into the same ledger-backed P&L."
        message={query.error instanceof Error ? query.error.message : "Unable to load people metrics."}
        title="People / Team"
      />
    )
  }

  const { people, departments, transactions, metrics } = query.data
  return (
    <PeopleOverview
      departments={departments}
      filters={filters}
      metrics={metrics}
      people={people}
      transactions={transactions}
    />
  )
}
