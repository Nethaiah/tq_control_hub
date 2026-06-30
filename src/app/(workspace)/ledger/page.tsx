import type { Metadata } from "next"

import { PageHeader, PageShell } from "@/components/common/page-shell"
import { QuerySuspenseBoundary } from "@/components/common/suspense-boundary"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LedgerWorkspace } from "@/features/ledger/components/ledger-workspace"

export const metadata: Metadata = {
  title: "Ledger | Techquarters Management Hub",
}

function LedgerWorkspaceFallback() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-32" />
              {index === 3 ? <Skeleton className="mt-3 h-3 w-20" /> : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-9 w-full max-w-sm" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-2 p-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function LedgerPage() {
  return (
    <PageShell>
      <PageHeader
        title="Ledger"
        description="Source of truth for every revenue and expense row. Filters, totals, and dashboard drill-downs all point here."
      />
      <QuerySuspenseBoundary
        fallback={<LedgerWorkspaceFallback />}
        errorVariant="block"
        title="Ledger could not load"
        description="Retry the ledger-backed source of truth."
      >
        <LedgerWorkspace />
      </QuerySuspenseBoundary>
    </PageShell>
  )
}
