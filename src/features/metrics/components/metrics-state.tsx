import { AlertTriangleIcon, Loader2Icon } from "lucide-react"

import { PageHeader, PageShell } from "@/components/common/page-shell"

export function MetricsLoading({ title, description }: { title: string; description: string }) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading metrics from the ledger...
      </div>
    </PageShell>
  )
}

export function MetricsError({
  title,
  description,
  message,
}: {
  title: string
  description: string
  message: string
}) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        <div>{message}</div>
      </div>
    </PageShell>
  )
}