import type { Metadata } from "next"

import { PageHeader, PageShell } from "@/components/common/page-shell"
import { LedgerWorkspace } from "@/features/ledger/components/ledger-workspace"

export const metadata: Metadata = {
  title: "Ledger | Techquarters Management Hub",
}

export default async function LedgerPage() {
  return (
    <PageShell>
      <PageHeader
        title="Ledger"
        description="Source of truth for every revenue and expense row. Filters, totals, and dashboard drill-downs all point here."
      />
      <LedgerWorkspace />
    </PageShell>
  )
}
