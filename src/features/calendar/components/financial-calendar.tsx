"use client"

import Link from "next/link"
import * as React from "react"
import { RepeatIcon, WalletCardsIcon } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/common/data-table"
import { HelpDialog } from "@/components/common/help-dialog"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KiboFinancialCalendar } from "@/features/calendar/components/kibo-financial-calendar"
import { buildLedgerHref } from "@/domain/filters"
import type { CalendarMetrics } from "@/domain/metrics"
import type { CalendarEvent } from "@/domain/types"
import { formatCurrency } from "@/domain/currency"
import { formatDate, titleCase } from "@/lib/format"

function eventVariant(type: CalendarEvent["type"]): "default" | "secondary" | "destructive" | "outline" {
  if (type === "payroll" || type === "tax") {
    return "destructive"
  }

  if (type === "retainer" || type === "invoice_due") {
    return "secondary"
  }

  return "outline"
}

function eventHref(event: CalendarEvent) {
  if (event.transactionId) {
    return buildLedgerHref({ from: "2026-06-01", to: "2026-06-30", ids: event.transactionId })
  }

  if (event.type === "payroll") {
    return buildLedgerHref({ from: "2026-06-01", to: "2026-06-30", type: "expense", categoryId: "cat_exp_payroll" })
  }

  if (event.type === "retainer" || event.type === "invoice_due") {
    return buildLedgerHref({ from: "2026-06-01", to: "2026-06-30", type: "revenue" })
  }

  return buildLedgerHref({ from: "2026-06-01", to: "2026-06-30" })
}

export function FinancialCalendar({ metrics }: { metrics: CalendarMetrics }) {
  type RecurringPreviewRow = CalendarMetrics["recurringGenerationPreview"][number]
  const recurringColumns = React.useMemo<ColumnDef<RecurringPreviewRow>[]>(() => [
    {
      accessorKey: "template",
      header: "Template",
    },
    {
      accessorKey: "nextRun",
      header: "Next run",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant={row.original.type === "revenue" ? "secondary" : "outline"}>{row.original.type}</Badge>,
    },
    {
      accessorKey: "amountUsd",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{formatCurrency(row.original.amountUsd)}</div>,
    },
    {
      accessorKey: "idempotencyKey",
      header: "Idempotency key",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.idempotencyKey}</span>,
    },
    {
      accessorKey: "calendarEventId",
      header: "Calendar event",
      cell: ({ row }) => row.original.calendarEventId ?? "Pending",
    },
  ], [])

  return (
    <PageShell>
      <PageHeader
        title="Financial calendar"
        description="Upcoming payroll, retainers, invoices, renewals, tax, and reviews generated from recurring items and ledger context."
        actions={
          <>
            <Button nativeButton={false} variant="outline" render={<Link href="/categories" />}>
              <RepeatIcon data-icon="inline-start" />
              Manage recurring templates
            </Button>
            <HelpDialog title="Cash timing view">
              Events can link back to source transactions or recurring templates. Recurring generation uses idempotency keys to prevent double posting.
            </HelpDialog>
          </>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Cash needed in next 30 days</CardDescription>
            <CardTitle>{formatCurrency(metrics.cashNeededUsd)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Expected recurring inflow</CardDescription>
            <CardTitle>{formatCurrency(metrics.expectedInflowUsd)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Scheduled outflow</CardDescription>
            <CardTitle>{formatCurrency(metrics.scheduledOutflowUsd)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Net scheduled cash</CardDescription>
            <CardTitle>{formatCurrency(metrics.netScheduledCashUsd)}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_0.68fr]">
        <Card>
          <CardHeader>
            <CardTitle>July month view</CardTitle>
            <CardDescription>Financial obligations and expected cash movements.</CardDescription>
          </CardHeader>
          <CardContent>
            <KiboFinancialCalendar events={metrics.events} />
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming obligations</CardTitle>
              <CardDescription>Next 30 days, with ledger or recurrence context.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {metrics.events.map((event) => (
                <Link key={event.id} href={eventHref(event)} className="rounded-lg border p-3 text-xs hover:bg-muted/70">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{event.title}</span>
                    <Badge variant={eventVariant(event.type)}>{titleCase(event.type)}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
                    <span>{formatDate(event.date)}</span>
                    <span>{formatCurrency(event.amountUsd)}</span>
                    <span>{event.transactionId ? "ledger-linked" : event.recurringItemId ? "recurring" : "review"}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Event mix</CardTitle>
              <CardDescription>Shows what is driving cash timing.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {metrics.eventsByType.map((item) => (
                <div key={item.type} className="flex items-center justify-between gap-3 rounded-md border p-3 text-xs">
                  <span>{titleCase(item.type)}</span>
                  <span className="font-mono tabular-nums">{item.count} · {formatCurrency(item.amountUsd)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recurring generation preview</CardTitle>
          <CardDescription>Templates that can generate transactions and calendar events without double counting.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={metrics.recurringGenerationPreview}
            columns={recurringColumns}
            getRowId={(row) => row.id}
            enableRowSelection
            searchPlaceholder="Search recurring previews"
            initialPageSize={5}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WalletCardsIcon className="size-4 shrink-0" />
            <CardTitle>Automation boundary</CardTitle>
          </div>
          <CardDescription>
            n8n can schedule reminders and stage generated rows. The ledger still requires validation and owner approval before commit.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  )
}
