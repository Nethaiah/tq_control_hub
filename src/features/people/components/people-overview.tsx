"use client"

import Link from "next/link"
import * as React from "react"
import { ArrowRightIcon, LinkIcon } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/common/data-table"
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buildLedgerHref } from "@/domain/filters"
import type { PeopleMetrics } from "@/domain/metrics"
import type { Department, Person, Transaction } from "@/domain/types"
import { formatCurrency, formatPercent } from "@/domain/currency"
import { formatDate } from "@/lib/format"

function departmentName(departments: Department[], departmentId: string) {
  return departments.find((department) => department.id === departmentId)?.name ?? "Unmapped"
}

function linkedTransactionRows(transactions: Transaction[], person: Person) {
  return transactions.filter((transaction) => person.transactionIds.includes(transaction.id))
}

export function PeopleOverview({
  people,
  departments,
  transactions,
  metrics,
}: {
  people: Person[]
  departments: Department[]
  transactions: Transaction[]
  metrics: PeopleMetrics
}) {
  const maxDepartmentCost = Math.max(
    ...metrics.departmentCosts.map((department) => department.peopleCostUsd),
    1
  )
  const columns = React.useMemo<ColumnDef<Person>[]>(() => [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: "department",
      accessorFn: (row) => departmentName(departments, row.departmentId),
      header: "Department",
    },
    {
      accessorKey: "role",
      header: "Role",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
    },
    {
      accessorKey: "costUsd",
      header: "Cost",
      meta: { align: "right" },
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{formatCurrency(row.original.costUsd)}</div>,
    },
    {
      accessorKey: "startDate",
      header: "Start date",
      cell: ({ row }) => formatDate(row.original.startDate),
    },
    {
      accessorKey: "status",
      header: "Status",
    },
    {
      id: "ledger_link",
      header: "Ledger link",
      enableSorting: false,
      cell: ({ row }) => {
        const person = row.original
        const linkedRows = linkedTransactionRows(transactions, person)

        return linkedRows.length > 0 ? (
          <Button
            nativeButton={false}
            variant="link"
            className="h-auto p-0"
            render={
              <Link href={buildLedgerHref({
                from: "2026-06-01",
                to: "2026-06-30",
                type: "expense",
                departmentId: person.departmentId,
                ids: person.transactionIds.join(","),
              })} />
            }
          >
            <LinkIcon data-icon="inline-start" />
            {linkedRows.length} rows
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Not posted</span>
        )
      },
    },
  ], [departments, transactions])

  return (
    <PageShell>
      <PageHeader
        title="People / Team"
        description="People costs, payroll pressure, and headcount by department. Linked payroll rows flow into the same ledger-backed P&L."
        actions={
          <>
            <Button nativeButton={false} variant="outline" render={<Link href="/ledger?type=expense&categoryId=cat_exp_payroll" />}>
              Open payroll rows
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <HelpDialog title="People costs are part of department P&L">
              Payroll and contractor rows are linked to ledger transactions where available. Unlinked people remain visible so the owner can spot cost not yet posted.
            </HelpDialog>
          </>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Active headcount</CardDescription>
            <CardTitle>{metrics.activeHeadcount}</CardTitle>
            <CardAction><Badge variant="outline">{metrics.employeeCount} employees</Badge></CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>People cost</CardDescription>
            <CardTitle>{formatCurrency(metrics.peopleCostUsd)}</CardTitle>
            <CardAction><Badge variant="outline">{metrics.contractorCount} contractors</Badge></CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Payroll as % of revenue</CardDescription>
            <CardTitle>{formatPercent(metrics.payrollAsRevenuePercent)}</CardTitle>
            <CardAction>
              <LedgerTrace
                count={metrics.departmentCosts.reduce((count, row) => count + row.transactionIds.length, 0)}
                filters={{ from: "2026-06-01", to: "2026-06-30", type: "expense", categoryId: "cat_exp_payroll" }}
              />
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Revenue per head</CardDescription>
            <CardTitle>{formatCurrency(metrics.revenuePerHeadUsd)}</CardTitle>
            <CardAction><Badge variant="secondary">June revenue</Badge></CardAction>
          </CardHeader>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cost by department</CardTitle>
            <CardDescription>Headcount, people cost, revenue per head, and ledger-linked payroll rows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {metrics.departmentCosts.map((department) => (
              <div key={department.departmentId} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{department.department}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{department.headcount} people</span>
                      <span>{department.employeeCount} employee</span>
                      <span>{department.contractorCount} contractor</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-medium tabular-nums">{formatCurrency(department.peopleCostUsd)}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(department.revenuePerHeadUsd)} / head</div>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar value={(department.peopleCostUsd / maxDepartmentCost) * 100} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Ledger-linked cost: {formatCurrency(department.linkedLedgerCostUsd)}
                  </span>
                  <LedgerTrace
                    count={department.transactionIds.length}
                    filters={{
                      from: "2026-06-01",
                      to: "2026-06-30",
                      type: "expense",
                      departmentId: department.departmentId,
                      ids: department.transactionIds.join(","),
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>People cost checks</CardTitle>
            <CardDescription>Owner-level checks before hiring or adding contractors.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Ledger-linked people costs</div>
              <div className="mt-1 text-xl font-semibold">{formatCurrency(metrics.linkedLedgerCostUsd)}</div>
              <p className="mt-1 text-xs text-muted-foreground">These rows already affect dashboard margin and department P&L.</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Unlinked active people</div>
              <div className="mt-1 text-xl font-semibold">{metrics.unlinkedPeopleCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Useful for spotting staff costs not yet represented by ledger rows.</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">June revenue used for ratios</div>
              <div className="mt-1 text-xl font-semibold">{formatCurrency(metrics.revenueUsd)}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team records</CardTitle>
          <CardDescription>PRD fields: name, department, role, type, cost, start date, status, and linked ledger rows.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={people}
            columns={columns}
            getRowId={(row) => row.id}
            enableRowSelection
            searchPlaceholder="Search people"
            initialPageSize={10}
          />
        </CardContent>
      </Card>
    </PageShell>
  )
}
