"use client"

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import type { PaginationState, SortingState } from "@tanstack/react-table"

const sortByValues = ["user", "access", "role", "status", "departments", "saved_status"] as const
const sortDirValues = ["asc", "desc"] as const

const settingsMembersParsers = {
  membersPage: parseAsInteger.withDefault(1),
  membersPageSize: parseAsInteger.withDefault(10),
  membersSearch: parseAsString,
  membersSortBy: parseAsStringLiteral(sortByValues),
  membersSortDir: parseAsStringLiteral(sortDirValues),
}

export type SettingsMembersUrlState = {
  page: number
  pageSize: number
  search: string | null
  sortBy: (typeof sortByValues)[number] | null
  sortDir: "asc" | "desc" | null
}

export type SettingsMembersUrlSetters = {
  setPagination: (pagination: PaginationState) => void
  setSearch: (search: string) => void
  setSorting: (sorting: SortingState) => void
}

export function useSettingsMembersUrlState(): [SettingsMembersUrlState, SettingsMembersUrlSetters] {
  const [values, setValues] = useQueryStates(settingsMembersParsers)

  const setPagination = (pagination: PaginationState) => {
    setValues({
      membersPage: pagination.pageIndex + 1,
      membersPageSize: pagination.pageSize,
    })
  }

  const setSorting = (sorting: SortingState) => {
    const sort = sorting[0]
    const sortId = sort?.id as (typeof sortByValues)[number] | undefined

    setValues({
      membersPage: 1,
      membersSortBy: sortId ?? null,
      membersSortDir: sort ? (sort.desc ? "desc" : "asc") : null,
    })
  }

  const setSearch = (search: string) => {
    setValues({
      membersPage: 1,
      membersSearch: search || null,
    })
  }

  return [
    {
      page: values.membersPage,
      pageSize: values.membersPageSize,
      search: values.membersSearch,
      sortBy: values.membersSortBy,
      sortDir: values.membersSortDir,
    },
    {
      setPagination,
      setSearch,
      setSorting,
    },
  ]
}
