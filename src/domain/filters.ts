import type { Client, Transaction, TransactionFilters } from "@/domain/types"

export const DEFAULT_MONTH_FILTERS: TransactionFilters = {
  from: "2026-06-01",
  to: "2026-06-30",
}

type SearchValue = string | string[] | undefined
type SearchParamsLike = Record<string, SearchValue>

const filterKeys = [
  "from",
  "to",
  "type",
  "departmentId",
  "categoryId",
  "clientOrVendor",
  "search",
  "source",
  "ids",
] as const

function firstValue(value: SearchValue) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export function filtersFromSearchParams(
  params: SearchParamsLike | undefined,
  fallback: TransactionFilters = DEFAULT_MONTH_FILTERS
): TransactionFilters {
  const filters: TransactionFilters = { ...fallback }

  for (const key of filterKeys) {
    const value = firstValue(params?.[key])
    if (value) {
      filters[key] = value as never
    }
  }

  return filters
}

export function filtersToSearchParams(filters: TransactionFilters) {
  const params = new URLSearchParams()

  for (const key of filterKeys) {
    const value = filters[key]
    if (value) {
      params.set(key, value)
    }
  }

  return params
}

export function buildLedgerHref(filters: TransactionFilters = {}) {
  const params = filtersToSearchParams(filters)
  const query = params.toString()
  return query ? `/ledger?${query}` : "/ledger"
}

export function exactLedgerFilters(
  filters: TransactionFilters,
  transactionIds: string[]
): TransactionFilters {
  return transactionIds.length > 0
    ? { ...filters, ids: Array.from(new Set(transactionIds)).join(",") }
    : filters
}

export function mergeFilters(
  base: TransactionFilters,
  patch: Partial<TransactionFilters>
) {
  const next: TransactionFilters = { ...base, ...patch }

  for (const key of filterKeys) {
    if (!next[key]) {
      delete next[key]
    }
  }

  return next
}

export function activeFilterCount(filters: TransactionFilters) {
  return filterKeys.filter((key) => Boolean(filters[key])).length
}

export function previousPeriod(filters: TransactionFilters): TransactionFilters {
  const from = new Date(filters.from ?? DEFAULT_MONTH_FILTERS.from ?? "2026-06-01")
  const to = new Date(filters.to ?? DEFAULT_MONTH_FILTERS.to ?? "2026-06-30")
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1)
  const previousTo = new Date(from)
  previousTo.setDate(previousTo.getDate() - 1)
  const previousFrom = new Date(previousTo)
  previousFrom.setDate(previousFrom.getDate() - days + 1)

  return {
    ...filters,
    from: previousFrom.toISOString().slice(0, 10),
    to: previousTo.toISOString().slice(0, 10),
  }
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  clients: Client[] = []
) {
  const clientNameById = new Map(clients.map((client) => [client.id, client.name]))
  const search = filters.search?.toLowerCase().trim()
  const clientOrVendor = filters.clientOrVendor?.toLowerCase().trim()
  const ids = filters.ids
    ? new Set(filters.ids.split(",").map((id) => id.trim()).filter(Boolean))
    : null

  return transactions.filter((transaction) => {
    if (ids && !ids.has(transaction.id)) {
      return false
    }

    if (filters.from && transaction.date < filters.from) {
      return false
    }

    if (filters.to && transaction.date > filters.to) {
      return false
    }

    if (filters.type && transaction.type !== filters.type) {
      return false
    }

    if (filters.departmentId && transaction.departmentId !== filters.departmentId) {
      return false
    }

    if (
      filters.categoryId &&
      transaction.categoryId !== filters.categoryId &&
      transaction.subcategoryId !== filters.categoryId
    ) {
      return false
    }

    if (filters.source && transaction.source !== filters.source) {
      return false
    }

    const clientName = transaction.clientId
      ? clientNameById.get(transaction.clientId) ?? ""
      : ""
    const vendor = transaction.vendor ?? ""

    if (
      clientOrVendor &&
      transaction.clientId !== filters.clientOrVendor &&
      vendor.toLowerCase() !== clientOrVendor &&
      clientName.toLowerCase() !== clientOrVendor
    ) {
      return false
    }

    if (search) {
      const haystack = [transaction.description, clientName, vendor]
        .join(" ")
        .toLowerCase()
      return haystack.includes(search)
    }

    return true
  })
}
