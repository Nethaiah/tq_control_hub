"use client"

import * as React from "react"
import { AlertTriangleIcon, BellIcon, DatabaseIcon, LockIcon, RepeatIcon, ShieldCheckIcon, WorkflowIcon } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/common/data-table"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { AppSettings, Integration, PermissionRole } from "@/domain/types"

type PermissionGuard = {
  area: string
  owner: string
  staff: string
}

function statusVariant(status: Integration["status"]): "secondary" | "outline" | "destructive" {
  if (status === "mirror_only") {
    return "destructive"
  }

  if (status === "planned") {
    return "secondary"
  }

  return "outline"
}

export function SettingsWorkspace({
  settings,
  integrations,
  permissionRoles,
}: {
  settings: AppSettings
  integrations: Integration[]
  permissionRoles: PermissionRole[]
}) {
  const operationalIntegrations = integrations.filter((integration) => integration.kind !== "mirror")
  const mirrors = integrations.filter((integration) => integration.kind === "mirror")
  const automationWorkflows = [
    {
      name: "Recurring generation",
      trigger: "Monthly n8n schedule",
      safety: "Uses recurrence_id + period idempotency key before any ledger draft is staged.",
      destination: "Import review / owner approval",
    },
    {
      name: "Calendar population",
      trigger: "Recurring item next_run changes",
      safety: "Creates reminders and calendar events first, never duplicate ledger transactions.",
      destination: "Financial calendar",
    },
    {
      name: "External sync",
      trigger: "Stripe, bank feed, accounting import",
      safety: "All external rows pass duplicate, date, currency, rules, AI, and human review gates.",
      destination: "CSV import staging",
    },
    {
      name: "Risk alerts",
      trigger: "Runway, budget, concentration, large expense checks",
      safety: "Slack/email notifications only. Alerts do not mutate ledger data.",
      destination: "Slack and email",
    },
    {
      name: "Scheduled reporting",
      trigger: "End-of-month close",
      safety: "Briefing drafts are generated from aggregates and require owner review before send.",
      destination: "Monthly briefing",
    },
  ]
  const permissionGuards = [
    { area: "Ledger commit", owner: "Can commit", staff: "Cannot commit" },
    { area: "Payroll detail", owner: "Visible", staff: "Hidden" },
    { area: "AI suggestions", owner: "Apply or dismiss", staff: "Prepare only" },
    { area: "Department view", owner: "All departments", staff: "Assigned department only" },
  ]
  const roleColumns = React.useMemo<ColumnDef<PermissionRole>[]>(() => [
    {
      accessorKey: "name",
      header: "Role",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "scope",
      header: "Scope",
    },
    {
      id: "permissions",
      accessorFn: (row) => row.permissions.join(" "),
      header: "Permissions",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.permissions.map((permission) => (
            <Badge key={permission} variant="outline">{permission}</Badge>
          ))}
        </div>
      ),
    },
  ], [])
  const guardColumns = React.useMemo<ColumnDef<PermissionGuard>[]>(() => [
    {
      accessorKey: "area",
      header: "Area",
      cell: ({ row }) => <span className="font-medium">{row.original.area}</span>,
    },
    {
      accessorKey: "owner",
      header: "Owner mode",
      cell: ({ row }) => <Badge variant="secondary">{row.original.owner}</Badge>,
    },
    {
      accessorKey: "staff",
      header: "Staff mode",
      cell: ({ row }) => <Badge variant="outline">{row.original.staff}</Badge>,
    },
  ], [])

  return (
    <PageShell>
      <PageHeader
        title="Settings / Integrations"
        description="Currency, source connections, notification destinations, roles, and hard safety boundaries for future backend work."
      />
      <Alert variant="destructive">
          <AlertTriangleIcon className="size-4 shrink-0" />
        <AlertTitle>Operational database boundary</AlertTitle>
        <AlertDescription>
          Notion and Airtable can only mirror human-readable views. They must never become the operational database or source of ledger truth.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Business settings</CardTitle>
            <CardDescription>Defaults used by reporting, ledger conversion, and owner context.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <span>Operating currency</span>
              <Badge variant="secondary">{settings.operatingCurrency}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <span>Reporting currency</span>
              <Badge variant="secondary">{settings.reportingCurrency}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <span>Fiscal year start</span>
              <span>{settings.fiscalYearStartMonth}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <span>Timezone</span>
              <span>{settings.timezone}</span>
            </div>
            <Separator />
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              {settings.approvalPolicy}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Source pipeline rules</CardTitle>
            <CardDescription>Every external source either stages data or sends notifications. No source commits directly.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium"><DatabaseIcon className="size-4 shrink-0" />Staging first</div>
              <p className="mt-2 text-xs text-muted-foreground">Stripe, bank feeds, and accounting syncs enter CSV/import review before the ledger changes.</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium"><ShieldCheckIcon className="size-4 shrink-0" />Human commit</div>
              <p className="mt-2 text-xs text-muted-foreground">AI suggestions and automations can draft rows, but the owner commits changes that affect the books.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connected source placeholders for the future Supabase, n8n, and external-source implementation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {operationalIntegrations.map((integration) => (
            <div key={integration.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{integration.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{integration.destination}</div>
                </div>
                <Badge variant={statusVariant(integration.status)}>{integration.status.replace("_", " ")}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <div className="rounded-md bg-muted/45 p-2">{integration.commitPolicy}</div>
                <div className="text-muted-foreground">{integration.notes}</div>
                <Badge variant={integration.stagingRequired ? "secondary" : "outline"} className="w-fit">
                  {integration.stagingRequired ? "Staging required" : "Notification only"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WorkflowIcon className="size-4 shrink-0" />
            n8n automation safety map
          </CardTitle>
          <CardDescription>
            Frontend runbook for recurring generation, calendar population, external sync, alerts, and scheduled reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {automationWorkflows.map((workflow) => (
            <div key={workflow.name} className="min-w-0 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{workflow.name}</div>
                <Badge variant="secondary">stages first</Badge>
              </div>
              <div className="mt-3 grid min-w-0 gap-2 text-xs text-muted-foreground">
                <div className="flex min-w-0 items-start gap-2"><RepeatIcon className="size-4 shrink-0" /><span className="min-w-0">{workflow.trigger}</span></div>
                <div className="flex min-w-0 items-start gap-2"><LockIcon className="size-4 shrink-0" /><span className="min-w-0">{workflow.safety}</span></div>
                <div className="flex min-w-0 items-start gap-2"><BellIcon className="size-4 shrink-0" /><span className="min-w-0">{workflow.destination}</span></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Roles and permissions preview</CardTitle>
            <CardDescription>Owner view and staff view differ before full auth is added.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={permissionRoles}
              columns={roleColumns}
              getRowId={(row) => row.id}
              enableRowSelection
              searchPlaceholder="Search roles"
              initialPageSize={5}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mirror-only destinations</CardTitle>
            <CardDescription>Useful for humans, never for source-of-truth writes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {mirrors.map((integration) => (
              <div key={integration.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{integration.name}</span>
                  <Badge variant="destructive">mirror only</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{integration.notes}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Permission guard preview</CardTitle>
          <CardDescription>Frontend coverage for owner view versus staff view before auth/RLS is added.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={permissionGuards}
            columns={guardColumns}
            getRowId={(row) => row.area}
            enableRowSelection
            searchPlaceholder="Search permission guards"
            initialPageSize={5}
          />
        </CardContent>
      </Card>
    </PageShell>
  )
}
