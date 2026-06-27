import { PageShell } from "@/components/common/page-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <PageShell>
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-52 w-full" /></CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </PageShell>
  )
}
