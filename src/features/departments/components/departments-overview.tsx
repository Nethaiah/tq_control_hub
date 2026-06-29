import Link from "next/link"
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react"

import { PageHeader, PageShell } from "@/components/common/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProgressBar } from "@/components/common/progress-bar"
import { buildLedgerHref } from "@/domain/filters"
import type { DepartmentRollup } from "@/domain/metrics"
import type { TransactionFilters } from "@/domain/types"
import { formatCurrency, formatPercent } from "@/domain/currency"

function TrendIcon({ trend }: { trend: DepartmentRollup["trend"] }) {
  if (trend === "up") {
    return <ArrowUpRightIcon />
  }

  if (trend === "down") {
    return <ArrowDownRightIcon />
  }

  return <MinusIcon />
}

export function DepartmentsOverview({
  rollups,
  filters,
}: {
  rollups: DepartmentRollup[]
  filters: TransactionFilters
}) {
  return (
    <PageShell>
      <PageHeader
        title="Departments"
        description="Each department is treated as its own mini business with revenue, cost, contribution margin, headcount, and budget usage."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rollups.map((rollup) => (
          <Card key={rollup.department.id}>
            <CardHeader>
              <CardTitle>{rollup.department.name}</CardTitle>
              <CardDescription>{rollup.headcount} active people</CardDescription>
              <CardAction>
                <Badge variant={rollup.budgetUsedPercent > 100 ? "destructive" : "outline"}>
                  {formatPercent(rollup.budgetUsedPercent)} budget
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Revenue</div>
                  <div className="font-mono font-medium tabular-nums">{formatCurrency(rollup.revenueUsd)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cost</div>
                  <div className="font-mono font-medium tabular-nums">{formatCurrency(rollup.expenseUsd)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Margin</div>
                  <div className="font-mono font-medium tabular-nums">{formatPercent(rollup.marginPercent)}</div>
                </div>
              </div>
              <ProgressBar value={rollup.budgetUsedPercent} />
              <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 p-3 text-xs">
                <span>Contribution margin</span>
                <span className="font-mono font-medium tabular-nums">{formatCurrency(rollup.contributionMarginUsd)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-xs">
                <span>Trend vs previous period</span>
                <Badge variant={rollup.trend === "down" ? "destructive" : "secondary"}>
                  <TrendIcon trend={rollup.trend} />
                  {rollup.trend}
                </Badge>
              </div>
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={buildLedgerHref({
                      ...filters,
                      departmentId: rollup.department.id,
                    })}
                  />
                }
              >
                Open source rows
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  )
}
