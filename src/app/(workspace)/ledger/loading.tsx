import { PageShell } from "@/components/common/page-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function LedgerLoading() {
  return (
    <PageShell>
      <Skeleton className="h-10 w-48" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    </PageShell>
  )
}
