"use client"

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import type { PaginationState, SortingState } from "@tanstack/react-table"

const recurringTypeValues = ["revenue", "expense"] as const
const sortByValues = ["template", "amount", "classification", "schedule"] as const
const sortDirValues = ["asc", "desc"] as const

const recurringItemsParsers = {
  recCategoryId: parseAsString,
  recDepartmentId: parseAsString,
  recPage: parseAsInteger.withDefault(1),
  recPageSize: parseAsInteger.withDefault(5),
  recSearch: parseAsString,
  recSortBy: parseAsStringLiteral(sortByValues),
  recSortDir: parseAsStringLiteral(sortDirValues),
  recType: parseAsStringLiteral(recurringTypeValues),
}

export type RecurringItemsUrlState = {
  categoryId: string | null
  departmentId: string | null
  page: number
  pageSize: number
  search: string | null
  sortBy: (typeof sortByValues)[number] | null
  sortDir: "asc" | "desc" | null
  type: (typeof recurringTypeValues)[number] | null
}

export type RecurringItemsUrlSetters = {
  resetFilters: () => void
  setCategoryId: (categoryId: string | null) => void
  setDepartmentId: (departmentId: string | null) => void
  setPagination: (pagination: PaginationState) => void
  setSearch: (search: string) => void
  setSorting: (sorting: SortingState) => void
  setType: (type: "revenue" | "expense" | null) => void
}

export function useRecurringItemsUrlState(): [RecurringItemsUrlState, RecurringItemsUrlSetters] {
  const [values, setValues] = useQueryStates(recurringItemsParsers)

  const setPagination = (pagination: PaginationState) => {
    setValues({
      recPage: pagination.pageIndex + 1,
      recPageSize: pagination.pageSize,
    })
  }

  const setSorting = (sorting: SortingState) => {
    const sort = sorting[0]
    const sortId = sort?.id as (typeof sortByValues)[number] | undefined

    setValues({
      recPage: 1,
      recSortBy: sortId ?? null,
      recSortDir: sort ? (sort.desc ? "desc" : "asc") : null,
    })
  }

  const setSearch = (search: string) => {
    setValues({
      recPage: 1,
      recSearch: search || null,
    })
  }

  const setType = (type: "revenue" | "expense" | null) => {
    setValues({ recPage: 1, recType: type })
  }

  const setDepartmentId = (departmentId: string | null) => {
    setValues({ recDepartmentId: departmentId, recPage: 1 })
  }

  const setCategoryId = (categoryId: string | null) => {
    setValues({ recCategoryId: categoryId, recPage: 1 })
  }

  const resetFilters = () => {
    setValues({
      recCategoryId: null,
      recDepartmentId: null,
      recPage: 1,
      recSearch: null,
      recSortBy: null,
      recSortDir: null,
      recType: null,
    })
  }

  return [
    {
      categoryId: values.recCategoryId,
      departmentId: values.recDepartmentId,
      page: values.recPage,
      pageSize: values.recPageSize,
      search: values.recSearch,
      sortBy: values.recSortBy,
      sortDir: values.recSortDir,
      type: values.recType,
    },
    {
      resetFilters,
      setCategoryId,
      setDepartmentId,
      setPagination,
      setSearch,
      setSorting,
      setType,
    },
  ]
}
