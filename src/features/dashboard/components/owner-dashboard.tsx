"use client"

import Link from "next/link"
import * as React from "react"
import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  MinusIcon,
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import {
  BudgetActualChart,
  DonutPanel,
  HorizontalValuePanel,
  MarginTrendChart,
  MrrTrendChart,
  RevenueExpenseChart,
} from "@/components/charts/financial-charts"
import { DataTable } from "@/components/common/data-table"
import { DateRangeControls } from "@/components/common/date-range-controls"
import { HelpDialog } from "@/components/common/help-dialog"
import { LedgerTrace } from "@/components/common/ledger-trace"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import { ProgressBar } from "@/components/common/progress-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buildLedgerHref, exactLedgerFilters } from "@/domain/filters"
import type { DashboardMetrics, DepartmentRollup } from "@/domain/metrics"
import { formatCurrency, formatPercent } from "@/domain/currency"

function DirectionIcon({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up") {
    return <ArrowUpRightIcon />
  }

  if (direction === "down") {
    return <ArrowDownRightIcon />
  }

  return <MinusIcon />
}

function KpiCards({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {metrics.kpis.map((kpi) => (
        <Card key={kpi.label} className="min-h-[150px]">
          <CardHeader>
            <CardDescription>{kpi.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {kpi.value}
            </CardTitle>
            <CardAction>
              <Badge variant={kpi.direction === "down" ? "destructive" : "outline"}>
                <DirectionIcon direction={kpi.direction} />
                {kpi.direction}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-2 text-xs">
            <span className="text-muted-foreground">{kpi.changeLabel}</span>
            <LedgerTrace
              count={kpi.trace.transactionIds.length}
              filters={kpi.trace.filters}
            />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function WeeklyActions({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>This week</CardTitle>
        <CardDescription>Owner actions generated from ledger-backed signals.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-3">
        {metrics.weeklyActions.map((action) => (
          <Link
            href={action.href}
            key={action.title}
            className="rounded-lg border bg-muted/35 p-3 transition-colors hover:bg-muted"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{action.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{action.detail}</div>
              </div>
              <ArrowRightIcon />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function DepartmentPnlTable({ rollups }: { rollups: DepartmentRollup[] }) {
  const transactionIds = rollups.flatMap((rollup) => rollup.transactionIds)
  const columns = React.useMemo<ColumnDef<DepartmentRollup>[]>(() => [
    {
      id: "department",
      accessorFn: (row) => row.department.name,
      header: "Department",
      cell: ({ row }) => {
        const rollup = row.original
        return (
          <Button
            nativeButton={false}
            variant="link"
            className="h-auto p-0"
            render={
              <Link
                href={buildLedgerHref({
                  from: "2026-06-01",
                  to: "2026-06-30",
                  departmentId: rollup.department.id,
                  ids: rollup.transactionIds.join(","),
                })}
              />
            }
          >
            {rollup.department.name}
          </Button>
        )
      },
    },
    {
      accessorKey: "revenueUsd",
      header: "Revenue",
      meta: { align: "right" },
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{formatCurrency(row.original.revenueUsd)}</div>,
    },
    {
      accessorKey: "expenseUsd",
      header: "Cost",
      meta: { align: "right" },
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{formatCurrency(row.original.expenseUsd)}</div>,
    },
    {
      accessorKey: "contributionMarginUsd",
      header: "Contribution",
      meta: { align: "right" },
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{formatCurrency(row.original.contributionMarginUsd)}</div>,
    },
    {
      accessorKey: "marginPercent",
      header: "Margin",
      meta: { align: "right" },
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{formatPercent(row.original.marginPercent)}</div>,
    },
    {
      accessorKey: "budgetUsedPercent",
      header: "Budget used",
      meta: { align: "right" },
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{formatPercent(row.original.budgetUsedPercent)}</div>,
    },
  ], [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Department P&L</CardTitle>
        <CardDescription>Each department as a mini business.</CardDescription>
        <CardAction>
          <LedgerTrace
            count={transactionIds.length}
            filters={exactLedgerFilters({ from: "2026-06-01", to: "2026-06-30" }, transactionIds)}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable
          data={rollups}
          columns={columns}
          getRowId={(row) => row.department.id}
          enableRowSelection
          searchPlaceholder="Search departments"
          initialPageSize={5}
        />
      </CardContent>
    </Card>
  )
}

function CashRunwayPanel({ metrics }: { metrics: DashboardMetrics }) {
  const runway = metrics.cashRunway
  const runwayTargetMonths = 12
  const runwayPercent = Math.min(100, (runway.runwayMonths / runwayTargetMonths) * 100)
  const change = runway.runwayMonths - runway.previousRunwayMonths

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash runway</CardTitle>
        <CardDescription>Survival view using cash on hand and current burn-rate assumptions.</CardDescription>
        <CardAction>
          <LedgerTrace count={runway.transactionIds.length} filters={runway.filters} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                {runway.runwayMonths.toFixed(1)} months
              </div>
              <div className="text-xs text-muted-foreground">
                {change >= 0 ? "+" : ""}{change.toFixed(1)} months vs previous period
              </div>
            </div>
            <Badge variant={runway.runwayMonths < 6 ? "destructive" : "secondary"}>
              {runway.runwayMonths < 6 ? "risk" : "healthy"}
            </Badge>
          </div>
          <ProgressBar value={runwayPercent} />
        </div>
        <div className="grid gap-2 text-xs">
          <div className="flex justify-between gap-3 rounded-md border p-2">
            <span>Assumed cash</span>
            <span className="font-mono tabular-nums">{formatCurrency(runway.assumedCashUsd)}</span>
          </div>
          <div className="flex justify-between gap-3 rounded-md border p-2">
            <span>Directional burn rate</span>
            <span className="font-mono tabular-nums">{formatCurrency(runway.burnRateUsd)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GrowthEfficiencyPanel({ metrics }: { metrics: DashboardMetrics }) {
  const efficiency = metrics.growthEfficiency

  return (
    <Card>
      <CardHeader>
        <CardTitle>Growth efficiency</CardTitle>
        <CardDescription>CAC, LTV, LTV:CAC, and payback period for the marketing-spend question.</CardDescription>
        <CardAction>
          <LedgerTrace count={efficiency.transactionIds.length} filters={efficiency.filters} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">CAC</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
              {formatCurrency(efficiency.cacUsd)}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">LTV</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
              {formatCurrency(efficiency.ltvUsd)}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">LTV:CAC</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
              {efficiency.ltvToCac.toFixed(1)}x
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">Payback</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
              {efficiency.paybackMonths.toFixed(1)} mo
            </div>
          </div>
        </div>
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {efficiency.assumptions.join(" ")}
        </div>
      </CardContent>
    </Card>
  )
}

export function OwnerDashboard({ metrics }: { metrics: DashboardMetrics }) {
  const topClient = metrics.topClients[0]
  const recurringKpi = metrics.kpis.find((kpi) => kpi.label === "MRR")

  return (
    <PageShell>
      <PageHeader
        title="Owner cockpit"
        description="June is profitable with a clear margin. Development is the heaviest cost base, and marketing spend needs CAC validation."
        actions={
          <>
            <Button nativeButton={false} variant="outline" render={<Link href="/ledger" />}>
              Open ledger
            </Button>
            <Button nativeButton={false} render={<Link href="/insights" />}>
              Ask AI
            </Button>
            <HelpDialog title="AI proposes, human commits">
              AI suggestions stay in draft or review states until the owner applies them. All figures below link back to source ledger rows.
            </HelpDialog>
          </>
        }
      />
      <DateRangeControls />
      <KpiCards metrics={metrics} />
      <WeeklyActions metrics={metrics} />
      <div className="grid gap-4 xl:grid-cols-2">
        <RevenueExpenseChart
          data={metrics.monthlySeries}
          rowCount={metrics.totals.rowCount}
          filters={metrics.filters}
          transactionIds={metrics.totals.transactionIds}
        />
        <MrrTrendChart
          data={metrics.mrrTrend}
          rowCount={recurringKpi?.trace.transactionIds.length ?? 0}
          filters={recurringKpi?.trace.filters ?? { ...metrics.filters, type: "revenue" }}
          transactionIds={recurringKpi?.trace.transactionIds ?? []}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <HorizontalValuePanel
          title="Revenue by department"
          description="Where the June revenue comes from."
          data={metrics.revenueByDepartment}
          nameKey="department"
          valueKey="revenue"
          rowCount={metrics.revenueByDepartment.reduce((count, row) => count + row.transactionIds.length, 0)}
          filters={{ ...metrics.filters, type: "revenue" }}
          itemFilterKey="departmentId"
          itemIdKey="departmentId"
        />
        <DonutPanel
          title="Expense breakdown"
          description="Main categories behind cash out."
          data={metrics.expenseByCategory}
          nameKey="category"
          dataKey="expense"
          rowCount={metrics.expenseByCategory.reduce((count, row) => count + row.transactionIds.length, 0)}
          filters={{ ...metrics.filters, type: "expense" }}
          itemFilterKey="categoryId"
          itemIdKey="categoryId"
        />
        <DonutPanel
          title="Revenue type split"
          description="One-off versus recurring dependence."
          data={metrics.revenueTypeSplit}
          nameKey="category"
          dataKey="revenue"
          rowCount={metrics.revenueTypeSplit.reduce((count, row) => count + row.transactionIds.length, 0)}
          filters={{ ...metrics.filters, type: "revenue" }}
          itemFilterKey="categoryId"
          itemIdKey="categoryId"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <MarginTrendChart
          data={metrics.monthlySeries.map((point) => ({
            label: point.label,
            marginPercent: point.marginPercent,
          }))}
          rowCount={metrics.totals.rowCount}
          filters={metrics.filters}
          transactionIds={metrics.totals.transactionIds}
        />
        <HorizontalValuePanel
          title="Top clients by revenue"
          description="Client concentration check for owner risk."
          data={metrics.topClients}
          nameKey="client"
          valueKey="revenue"
          rowCount={metrics.topClients.reduce((count, row) => count + row.transactionIds.length, 0)}
          filters={{ ...metrics.filters, type: "revenue" }}
          itemFilterKey="clientOrVendor"
          itemIdKey="clientId"
          concentrationLabel={
            topClient
              ? `${topClient.client} contributes ${formatPercent(topClient.concentrationPercent)} of June revenue.`
              : undefined
          }
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DepartmentPnlTable rollups={metrics.departmentRollups} />
        <BudgetActualChart
          data={metrics.budgetVsActual}
          rowCount={metrics.budgetVsActual.reduce((count, row) => count + row.transactionIds.length, 0)}
          filters={{ ...metrics.filters, type: "expense" }}
          transactionIds={metrics.budgetVsActual.flatMap((row) => row.transactionIds)}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <CashRunwayPanel metrics={metrics} />
        <GrowthEfficiencyPanel metrics={metrics} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Anomaly flags</CardTitle>
          <CardDescription>Operational checks surfaced from the same ledger rows.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          {metrics.anomalies.map((anomaly) => (
            <Link key={anomaly.id} href={anomaly.href} className="rounded-lg border p-3 hover:bg-muted/70">
              <Badge variant={anomaly.severity === "risk" ? "destructive" : "secondary"}>
                {anomaly.severity}
              </Badge>
              <div className="mt-2 font-medium">{anomaly.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {anomaly.transactionIds.length} source rows
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  )
}
