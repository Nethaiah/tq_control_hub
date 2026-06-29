"use client"

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"

import { DEFAULT_MONTH_FILTERS } from "@/domain/filters"
import type { TransactionFilters } from "@/domain/types"
import type { PaginationState, SortingState } from "@tanstack/react-table"

const transactionSourceValues = ["manual", "csv", "automation"] as const
const transactionTypeValues = ["revenue", "expense"] as const
const sortByValues = [
  "date",
  "type",
  "description",
  "amount",
  "department",
  "category",
  "source",
  "recurring",
] as const
const sortDirValues = ["asc", "desc"] as const

const ledgerParsers = {
  categoryId: parseAsString,
  clientOrVendor: parseAsString,
  departmentId: parseAsString,
  from: parseAsString.withDefault(DEFAULT_MONTH_FILTERS.from!),
  ids: parseAsString,
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(10),
  search: parseAsString,
  sortBy: parseAsStringLiteral(sortByValues),
  sortDir: parseAsStringLiteral(sortDirValues),
  source: parseAsStringLiteral(transactionSourceValues),
  to: parseAsString.withDefault(DEFAULT_MONTH_FILTERS.to!),
  type: parseAsStringLiteral(transactionTypeValues),
}

export type LedgerUrlState = {
  filters: TransactionFilters
  page: number
  pageSize: number
  search: string | null
  sortBy: string | null
  sortDir: "asc" | "desc" | null
}

export type LedgerUrlSetters = {
  setFilters: (patch: Partial<TransactionFilters>) => void
  clearFilter: (key: keyof TransactionFilters) => void
  resetFilters: () => void
  setPagination: (pagination: PaginationState) => void
  setSorting: (sorting: SortingState) => void
  setSearch: (search: string) => void
}

export function useLedgerUrlState(): [LedgerUrlState, LedgerUrlSetters] {
  const [values, setValues] = useQueryStates(ledgerParsers)

  const filters: TransactionFilters = {
    categoryId: values.categoryId ?? undefined,
    clientOrVendor: values.clientOrVendor ?? undefined,
    departmentId: values.departmentId ?? undefined,
    from: values.from,
    ids: values.ids ?? undefined,
    search: values.search ?? undefined,
    source: values.source ?? undefined,
    to: values.to,
    type: values.type ?? undefined,
  }

  const setFilters = (patch: Partial<TransactionFilters>) => {
    const next: TransactionFilters = {
      ...filters,
      ...patch,
    }

    setValues({
      categoryId: next.categoryId ?? null,
      clientOrVendor: next.clientOrVendor ?? null,
      departmentId: next.departmentId ?? null,
      from: next.from ?? null,
      ids: next.ids ?? null,
      page: 1,
      search: next.search ?? null,
      source: next.source ?? null,
      to: next.to ?? null,
      type: next.type ?? null,
    })
  }

  const clearFilter = (key: keyof TransactionFilters) => {
    setFilters({ [key]: undefined })
  }

  const resetFilters = () => {
    setValues({
      categoryId: null,
      clientOrVendor: null,
      departmentId: null,
      from: null,
      ids: null,
      page: 1,
      search: null,
      source: null,
      to: null,
      type: null,
    })
  }

  const setPagination = (pagination: PaginationState) => {
    setValues({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    })
  }

  const setSorting = (sorting: SortingState) => {
    const sort = sorting[0]
    const sortId = sort?.id as (typeof sortByValues)[number] | undefined
    setValues({
      page: 1,
      sortBy: sortId ?? null,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : null,
    })
  }

  const setSearch = (search: string) => {
    setValues({
      ids: null,
      page: 1,
      search: search || null,
    })
  }

  return [
    {
      filters,
      page: values.page,
      pageSize: values.pageSize,
      search: values.search,
      sortBy: values.sortBy,
      sortDir: values.sortDir,
    },
    {
      clearFilter,
      resetFilters,
      setFilters,
      setPagination,
      setSearch,
      setSorting,
    },
  ]
}
