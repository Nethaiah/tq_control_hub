import type { Metadata } from "next"

import { PageHeader, PageShell } from "@/components/common/page-shell"
import { getLedgerData } from "@/data/mock-repository"
import { filtersFromSearchParams } from "@/domain/filters"
import { LedgerWorkspace } from "@/features/ledger/components/ledger-workspace"

export const metadata: Metadata = {
  title: "Ledger | Techquarters Management Hub",
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LedgerPage({ searchParams }: PageProps) {
  const filters = filtersFromSearchParams(await searchParams)
  const data = getLedgerData(filters)

  return (
    <PageShell>
      <PageHeader
        title="Ledger"
        description="Source of truth for every revenue and expense row. Filters, totals, and dashboard drill-downs all point here."
      />
      <LedgerWorkspace
        rows={data.rows}
        departments={data.departments}
        categories={data.categories}
        clients={data.clients}
      />
    </PageShell>
  )
}
