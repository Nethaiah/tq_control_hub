"use client"

import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { LedgerTrace } from "@/components/common/ledger-trace"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { buildLedgerHref, exactLedgerFilters } from "@/domain/filters"
import type { TransactionFilters } from "@/domain/types"
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/domain/currency"

const revenueExpenseConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
  netProfit: { label: "Net profit", color: "var(--chart-4)" },
} satisfies ChartConfig

const mrrConfig = {
  newMrr: { label: "New", color: "var(--chart-1)" },
  expansionMrr: { label: "Expansion", color: "var(--chart-4)" },
  churnMrr: { label: "Churn", color: "var(--chart-2)" },
  endingMrr: { label: "Ending MRR", color: "var(--chart-3)" },
} satisfies ChartConfig

const marginConfig = {
  marginPercent: { label: "Margin", color: "var(--chart-4)" },
} satisfies ChartConfig

const barConfig = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig

const donutColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
]

function itemLedgerFilters(
  filters: TransactionFilters,
  item: Record<string, string | number | string[]>,
  itemFilterKey?: keyof TransactionFilters,
  itemIdKey = "categoryId"
) {
  const itemId = item[itemIdKey]
  const transactionIds = Array.isArray(item.transactionIds) ? item.transactionIds : []
  const base = itemFilterKey && itemId
    ? ({ ...filters, [itemFilterKey]: String(itemId) } as TransactionFilters)
    : filters

  return exactLedgerFilters(base, transactionIds)
}

export function RevenueExpenseChart({
  data,
  rowCount,
  filters,
  transactionIds = [],
}: {
  data: Array<{
    label: string
    revenue: number
    expenses: number
    netProfit: number
  }>
  rowCount: number
  filters: TransactionFilters
  transactionIds?: string[]
}) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <CardTitle>Revenue vs expenses</CardTitle>
        <CardDescription>Bars show money in and out. The line shows net profit.</CardDescription>
        <CardAction>
          <LedgerTrace count={rowCount} filters={exactLedgerFilters(filters, transactionIds)} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueExpenseConfig} className="h-[260px] w-full">
          <ComposedChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
            <Line dataKey="netProfit" stroke="var(--color-netProfit)" strokeWidth={2} type="monotone" />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function MrrTrendChart({
  data,
  rowCount,
  filters,
  transactionIds = [],
}: {
  data: Array<{
    label: string
    newMrr: number
    expansionMrr: number
    churnMrr: number
    endingMrr: number
  }>
  rowCount: number
  filters: TransactionFilters
  transactionIds?: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>MRR movement</CardTitle>
        <CardDescription>Recurring revenue growth from retainers and AI subscriptions.</CardDescription>
        <CardAction>
          <LedgerTrace count={rowCount} filters={exactLedgerFilters(filters, transactionIds)} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={mrrConfig} className="h-[240px] w-full">
          <ComposedChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="newMrr" stackId="mrr" fill="var(--color-newMrr)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expansionMrr" stackId="mrr" fill="var(--color-expansionMrr)" />
            <Bar dataKey="churnMrr" stackId="mrr" fill="var(--color-churnMrr)" />
            <Line dataKey="endingMrr" stroke="var(--color-endingMrr)" strokeWidth={2} type="monotone" />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function MarginTrendChart({
  data,
  rowCount,
  filters,
  transactionIds = [],
}: {
  data: Array<{ label: string; marginPercent: number }>
  rowCount: number
  filters: TransactionFilters
  transactionIds?: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit margin trend</CardTitle>
        <CardDescription>Efficiency trend across the sample months.</CardDescription>
        <CardAction>
          <LedgerTrace count={rowCount} filters={exactLedgerFilters(filters, transactionIds)} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={marginConfig} className="h-[220px] w-full">
          <ComposedChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatPercent(Number(value))} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="marginPercent" stroke="var(--color-marginPercent)" strokeWidth={2} type="monotone" />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function DonutPanel({
  title,
  description,
  data,
  dataKey,
  nameKey,
  rowCount,
  filters,
  itemFilterKey,
  itemIdKey = "categoryId",
}: {
  title: string
  description: string
  data: Array<Record<string, string | number | string[]>>
  dataKey: string
  nameKey: string
  rowCount: number
  filters: TransactionFilters
  itemFilterKey?: keyof TransactionFilters
  itemIdKey?: string
}) {
  const panelIds = data.flatMap((item) => Array.isArray(item.transactionIds) ? item.transactionIds : [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <LedgerTrace count={rowCount} filters={exactLedgerFilters(filters, panelIds)} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[190px_1fr] md:items-center">
        <ChartContainer config={barConfig} className="h-[190px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={48} outerRadius={78} paddingAngle={2}>
              {data.map((_, index) => (
                <Cell key={index} fill={donutColors[index % donutColors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="grid gap-2">
          {data.map((item, index) => (
            <Link
              href={buildLedgerHref(itemLedgerFilters(filters, item, itemFilterKey, itemIdKey))}
              key={String(item[nameKey])}
              className="flex items-center justify-between gap-3 rounded-md p-1 hover:bg-muted/70"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: donutColors[index % donutColors.length] }}
                />
                <span className="truncate text-xs">{String(item[nameKey])}</span>
              </div>
              <span className="font-mono text-xs tabular-nums">
                {formatCurrency(Number(item[dataKey]))}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function HorizontalValuePanel({
  title,
  description,
  data,
  valueKey,
  nameKey,
  rowCount,
  filters,
  concentrationLabel,
  itemFilterKey,
  itemIdKey = "departmentId",
}: {
  title: string
  description: string
  data: Array<Record<string, string | number | string[]>>
  valueKey: string
  nameKey: string
  rowCount: number
  filters: TransactionFilters
  concentrationLabel?: string
  itemFilterKey?: keyof TransactionFilters
  itemIdKey?: string
}) {
  const max = Math.max(...data.map((item) => Number(item[valueKey])), 1)
  const panelIds = data.flatMap((item) => Array.isArray(item.transactionIds) ? item.transactionIds : [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <LedgerTrace count={rowCount} filters={exactLedgerFilters(filters, panelIds)} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {concentrationLabel ? (
          <div className="rounded-md border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {concentrationLabel}
          </div>
        ) : null}
        {data.map((item) => (
          <Link
            href={buildLedgerHref(itemLedgerFilters(filters, item, itemFilterKey, itemIdKey))}
            key={String(item[nameKey])}
            className="grid gap-1 rounded-md p-1 hover:bg-muted/70"
          >
            <div className="flex justify-between gap-3 text-xs">
              <span>{String(item[nameKey])}</span>
              <span className="font-mono tabular-nums">{formatCurrency(Number(item[valueKey]))}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.max(3, (Number(item[valueKey]) / max) * 100)}%` }}
              />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

export function BudgetActualChart({
  data,
  rowCount,
  filters,
  transactionIds = [],
}: {
  data: Array<{ department: string; budget: number; actual: number }>
  rowCount: number
  filters: TransactionFilters
  transactionIds?: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget vs actual</CardTitle>
        <CardDescription>Department spend against current monthly budget.</CardDescription>
        <CardAction>
          <LedgerTrace count={rowCount} filters={exactLedgerFilters(filters, transactionIds)} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueExpenseConfig} className="h-[260px] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="department" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="budget" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="actual" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
