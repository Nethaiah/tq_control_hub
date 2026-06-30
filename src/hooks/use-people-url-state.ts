"use client"

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import type { PaginationState, SortingState } from "@tanstack/react-table"

const sortByValues = ["name", "department", "role", "type", "costUsd", "startDate", "status"] as const
const sortDirValues = ["asc", "desc"] as const

const peopleParsers = {
  peoplePage: parseAsInteger.withDefault(1),
  peoplePageSize: parseAsInteger.withDefault(10),
  peopleSearch: parseAsString,
  peopleSortBy: parseAsStringLiteral(sortByValues),
  peopleSortDir: parseAsStringLiteral(sortDirValues),
}

export type PeopleUrlState = {
  page: number
  pageSize: number
  search: string | null
  sortBy: (typeof sortByValues)[number] | null
  sortDir: "asc" | "desc" | null
}

export type PeopleUrlSetters = {
  setPagination: (pagination: PaginationState) => void
  setSearch: (search: string) => void
  setSorting: (sorting: SortingState) => void
}

export function usePeopleUrlState(): [PeopleUrlState, PeopleUrlSetters] {
  const [values, setValues] = useQueryStates(peopleParsers)

  const setPagination = (pagination: PaginationState) => {
    setValues({
      peoplePage: pagination.pageIndex + 1,
      peoplePageSize: pagination.pageSize,
    })
  }

  const setSorting = (sorting: SortingState) => {
    const sort = sorting[0]
    const sortId = sort?.id as (typeof sortByValues)[number] | undefined

    setValues({
      peoplePage: 1,
      peopleSortBy: sortId ?? null,
      peopleSortDir: sort ? (sort.desc ? "desc" : "asc") : null,
    })
  }

  const setSearch = (search: string) => {
    setValues({
      peoplePage: 1,
      peopleSearch: search || null,
    })
  }

  return [
    {
      page: values.peoplePage,
      pageSize: values.peoplePageSize,
      search: values.peopleSearch,
      sortBy: values.peopleSortBy,
      sortDir: values.peopleSortDir,
    },
    {
      setPagination,
      setSearch,
      setSorting,
    },
  ]
}
