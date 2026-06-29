"use client"

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"

import { DEFAULT_MONTH_FILTERS } from "@/domain/filters"
import type { TransactionFilters } from "@/domain/types"

const transactionSourceValues = ["manual", "csv", "automation"] as const
const transactionTypeValues = ["revenue", "expense"] as const

const filterParsers = {
  categoryId: parseAsString,
  clientOrVendor: parseAsString,
  departmentId: parseAsString,
  from: parseAsString.withDefault(DEFAULT_MONTH_FILTERS.from!),
  ids: parseAsString,
  search: parseAsString,
  source: parseAsStringLiteral(transactionSourceValues),
  to: parseAsString.withDefault(DEFAULT_MONTH_FILTERS.to!),
  type: parseAsStringLiteral(transactionTypeValues),
}

export function useUrlFilters() {
  const [values, setValues] = useQueryStates(filterParsers)

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
    setValues({
      categoryId: patch.categoryId ?? null,
      clientOrVendor: patch.clientOrVendor ?? null,
      departmentId: patch.departmentId ?? null,
      from: patch.from ?? null,
      ids: patch.ids ?? null,
      search: patch.search ?? null,
      source: patch.source ?? null,
      to: patch.to ?? null,
      type: patch.type ?? null,
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
      search: null,
      source: null,
      to: null,
      type: null,
    })
  }

  return { filters, setFilters, clearFilter, resetFilters }
}
