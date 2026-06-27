"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"

import {
  filtersFromSearchParams,
  filtersToSearchParams,
  mergeFilters,
} from "@/domain/filters"
import type { TransactionFilters } from "@/domain/types"

export function useUrlFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = React.useMemo(
    () => filtersFromSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams]
  )

  const setFilters = React.useCallback(
    (patch: Partial<TransactionFilters>) => {
      const next = mergeFilters(filters, patch)
      const params = filtersToSearchParams(next)
      const query = params.toString()

      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [filters, pathname, router]
  )

  const clearFilter = React.useCallback(
    (key: keyof TransactionFilters) => {
      setFilters({ [key]: undefined })
    },
    [setFilters]
  )

  const resetFilters = React.useCallback(() => {
    router.replace(pathname)
  }, [pathname, router])

  return { filters, setFilters, clearFilter, resetFilters }
}
