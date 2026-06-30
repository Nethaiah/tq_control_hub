"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import type { PaginationState, SortingState } from "@tanstack/react-table"

import { PeopleOverview } from "@/features/people/components/people-overview"
import { readApiResponse } from "@/features/metrics/api-client"
import { filtersToSearchParams } from "@/domain/filters"
import { usePeopleUrlState, type PeopleUrlState } from "@/hooks/use-people-url-state"
import { useUrlFilters } from "@/hooks/use-url-filters"
import type { PeopleMetrics } from "@/domain/metrics"
import type { Department, Person, Transaction } from "@/domain/types"

type PeopleMetricsResponse = {
  people: Person[]
  departments: Department[]
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
  transactions: Transaction[]
  metrics: PeopleMetrics
}

async function fetchPeopleMetrics(filters: ReturnType<typeof useUrlFilters>["filters"], tableState: PeopleUrlState) {
  const params = filtersToSearchParams(filters)
  params.set("peoplePage", String(tableState.page))
  params.set("peoplePageSize", String(tableState.pageSize))
  if (tableState.search) params.set("peopleSearch", tableState.search)
  if (tableState.sortBy) params.set("peopleSortBy", tableState.sortBy)
  if (tableState.sortDir) params.set("peopleSortDir", tableState.sortDir)

  const query = params.toString()
  const response = await fetch(`/api/metrics/people${query ? `?${query}` : ""}`, {
    credentials: "same-origin",
  })
  return readApiResponse<PeopleMetricsResponse>(response, "Unable to load people metrics")
}

export function PeopleWorkspace() {
  const { filters } = useUrlFilters()
  const [tableState, tableSetters] = usePeopleUrlState()
  const query = useSuspenseQuery({
    queryFn: () => fetchPeopleMetrics(filters, tableState),
    queryKey: ["metrics", "people", filters, tableState],
    staleTime: 60_000,
  })

  const { people, departments, transactions, metrics, pagination } = query.data
  const controlledPagination: PaginationState = {
    pageIndex: Math.max(0, pagination.page - 1),
    pageSize: pagination.pageSize,
  }
  const controlledSorting: SortingState = tableState.sortBy
    ? [{ desc: tableState.sortDir === "desc", id: tableState.sortBy }]
    : []

  return (
    <PeopleOverview
      controlledPagination={controlledPagination}
      controlledSearch={tableState.search ?? ""}
      controlledSorting={controlledSorting}
      departments={departments}
      filters={filters}
      metrics={metrics}
      onPaginationChange={tableSetters.setPagination}
      onSearchChange={tableSetters.setSearch}
      onSortingChange={tableSetters.setSorting}
      pagination={pagination}
      people={people}
      transactions={transactions}
    />
  )
}
