"use client"

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import type { PaginationState, SortingState } from "@tanstack/react-table"

const sortByValues = [
  "department",
  "revenueUsd",
  "expenseUsd",
  "contributionMarginUsd",
  "marginPercent",
  "budgetUsedPercent",
] as const
const sortDirValues = ["asc", "desc"] as const

const departmentPnlParsers = {
  pnlPage: parseAsInteger.withDefault(1),
  pnlPageSize: parseAsInteger.withDefault(5),
  pnlSearch: parseAsString,
  pnlSortBy: parseAsStringLiteral(sortByValues),
  pnlSortDir: parseAsStringLiteral(sortDirValues),
}

export type DepartmentPnlUrlState = {
  page: number
  pageSize: number
  search: string | null
  sortBy: (typeof sortByValues)[number] | null
  sortDir: "asc" | "desc" | null
}

export type DepartmentPnlUrlSetters = {
  setPagination: (pagination: PaginationState) => void
  setSearch: (search: string) => void
  setSorting: (sorting: SortingState) => void
}

export function useDepartmentPnlUrlState(): [DepartmentPnlUrlState, DepartmentPnlUrlSetters] {
  const [values, setValues] = useQueryStates(departmentPnlParsers)

  const setPagination = (pagination: PaginationState) => {
    setValues({
      pnlPage: pagination.pageIndex + 1,
      pnlPageSize: pagination.pageSize,
    })
  }

  const setSorting = (sorting: SortingState) => {
    const sort = sorting[0]
    const sortId = sort?.id as (typeof sortByValues)[number] | undefined
    setValues({
      pnlPage: 1,
      pnlSortBy: sortId ?? null,
      pnlSortDir: sort ? (sort.desc ? "desc" : "asc") : null,
    })
  }

  const setSearch = (search: string) => {
    setValues({
      pnlPage: 1,
      pnlSearch: search || null,
    })
  }

  return [
    {
      page: values.pnlPage,
      pageSize: values.pnlPageSize,
      search: values.pnlSearch,
      sortBy: values.pnlSortBy,
      sortDir: values.pnlSortDir,
    },
    {
      setPagination,
      setSearch,
      setSorting,
    },
  ]
}
