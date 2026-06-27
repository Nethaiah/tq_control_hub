import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buildLedgerHref } from "@/domain/filters"
import type { TransactionFilters } from "@/domain/types"

export function LedgerTrace({
  count,
  filters,
  label = "ledger rows",
}: {
  count: number
  filters: TransactionFilters
  label?: string
}) {
  return (
    <Badge variant="outline" render={<Link href={buildLedgerHref(filters)} />}>
      {count} {label}
    </Badge>
  )
}
