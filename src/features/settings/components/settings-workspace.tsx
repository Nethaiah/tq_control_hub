"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef, Table as TanStackTable } from "@tanstack/react-table"
import {
  AlertTriangleIcon,
  BellIcon,
  DatabaseIcon,
  Loader2Icon,
  LockIcon,
  RepeatIcon,
  SaveIcon,
  ShieldCheckIcon,
  UserCogIcon,
  WorkflowIcon,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable } from "@/components/common/data-table"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AppSettings, Integration, PermissionRole } from "@/domain/types"

type PermissionGuard = {
  area: string
  owner: string
  staff: string
}

type MemberRole = "owner" | "staff"
type MemberStatus = "active" | "invited" | "disabled"

type SettingsDepartment = {
  active: boolean
  color: string
  id: string
  name: string
}

type SettingsMember = {
  departmentIds: string[]
  email: string
  fullName: string
  memberId: string | null
  role: MemberRole | null
  status: MemberStatus | null
  userId: string
}

type SettingsMembersData = {
  departments: SettingsDepartment[]
  members: SettingsMember[]
}

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } }

type UpdateMemberInput = {
  departmentIds: string[]
  role: MemberRole
  status: MemberStatus
  userId: string
}

type MemberDraft = {
  departmentIds: string[]
  role: MemberRole
  status: MemberStatus
}

type BulkMemberPatch = {
  departmentIds?: string[]
  role?: MemberRole
  status?: MemberStatus
}

const settingsMembersQueryKey = ["settings-members"] as const

async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload && !payload.ok ? payload.error.message : fallbackMessage)
  }

  return payload.data
}

async function fetchSettingsMembers() {
  const response = await fetch("/api/settings/members", { credentials: "same-origin" })

  return readApiResponse<SettingsMembersData>(response, "Unable to load member access")
}

async function updateSettingsMember(input: UpdateMemberInput) {
  const response = await fetch(`/api/settings/members/${encodeURIComponent(input.userId)}`, {
    body: JSON.stringify({
      departmentIds: input.departmentIds,
      role: input.role,
      status: input.status,
    }),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  })

  return readApiResponse<{ member: SettingsMember }>(response, "Unable to save member access")
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

function memberStatusVariant(status: MemberStatus | null): "secondary" | "outline" | "destructive" {
  if (status === "disabled") {
    return "destructive"
  }

  if (status === "active") {
    return "secondary"
  }

  return "outline"
}

function initialDraft(member: SettingsMember): MemberDraft {
  return {
    departmentIds: member.departmentIds,
    role: member.role ?? "staff",
    status: member.status ?? "invited",
  }
}

function sortedDepartmentIds(departmentIds: string[]) {
  return [...new Set(departmentIds)].sort()
}

function departmentIdsMatch(a: string[], b: string[]) {
  return sortedDepartmentIds(a).join("|") === sortedDepartmentIds(b).join("|")
}

function memberIsDirty(member: SettingsMember, draft: MemberDraft) {
  const saved = initialDraft(member)

  return (
    !member.memberId ||
    draft.role !== saved.role ||
    draft.status !== saved.status ||
    !departmentIdsMatch(draft.departmentIds, saved.departmentIds)
  )
}

function departmentSummary(departments: SettingsDepartment[], role: MemberRole, departmentIds: string[]) {
  if (role === "owner") {
    return "All departments"
  }

  const selected = departments.filter((department) => departmentIds.includes(department.id))

  if (selected.length === 0) {
    return "No departments"
  }

  if (selected.length <= 2) {
    return selected.map((department) => department.name).join(", ")
  }

  return `${selected.length} departments`
}

function updateMemberInCache(queryClient: ReturnType<typeof useQueryClient>, member: SettingsMember) {
  queryClient.setQueryData<SettingsMembersData>(settingsMembersQueryKey, (current) =>
    current
      ? {
          ...current,
          members: current.members.map((currentMember) =>
            currentMember.userId === member.userId ? member : currentMember
          ),
        }
      : current
  )
}

function MemberAccessManager() {
  const queryClient = useQueryClient()
  const membersQuery = useQuery({
    queryFn: fetchSettingsMembers,
    queryKey: settingsMembersQueryKey,
  })
  const updateMemberMutation = useMutation({
    mutationFn: updateSettingsMember,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save member access")
    },
  })
  const [savingUserIds, setSavingUserIds] = React.useState<Set<string>>(new Set())

  if (membersQuery.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading registered users...
      </div>
    )
  }

  if (membersQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangleIcon className="size-4 shrink-0" />
        <AlertTitle>Member access unavailable</AlertTitle>
        <AlertDescription>
          {membersQuery.error instanceof Error ? membersQuery.error.message : "Unable to load registered users."}
        </AlertDescription>
      </Alert>
    )
  }

  const { departments, members } = membersQuery.data

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No registered Supabase users have created profiles yet.
      </div>
    )
  }

  return (
    <MemberAccessTable
      departments={departments}
      members={members}
      onBulkSave={async (inputs) => {
        const userIds = inputs.map((input) => input.userId)
        setSavingUserIds((current) => new Set([...current, ...userIds]))

        const results = await Promise.allSettled(inputs.map((input) => updateMemberMutation.mutateAsync(input)))
        let successCount = 0
        let failureCount = 0

        for (const result of results) {
          if (result.status === "fulfilled") {
            successCount += 1
            updateMemberInCache(queryClient, result.value.member)
          } else {
            failureCount += 1
          }
        }

        setSavingUserIds((current) => {
          const next = new Set(current)
          for (const userId of userIds) {
            next.delete(userId)
          }
          return next
        })

        await queryClient.invalidateQueries({ queryKey: settingsMembersQueryKey })

        if (successCount > 0 && failureCount === 0) {
          toast.success(`Updated ${successCount} ${successCount === 1 ? "member" : "members"}`)
        } else if (successCount > 0) {
          toast.warning(`Updated ${successCount}, ${failureCount} failed`)
        } else {
          toast.error("Unable to update selected members")
        }

        return successCount > 0
      }}
      onSave={async (input) => {
        setSavingUserIds((current) => new Set(current).add(input.userId))

        try {
          const { member } = await updateMemberMutation.mutateAsync(input)
          updateMemberInCache(queryClient, member)
          toast.success("Member access saved")
        } finally {
          setSavingUserIds((current) => {
            const next = new Set(current)
            next.delete(input.userId)
            return next
          })
        }
      }}
      savingUserIds={savingUserIds}
    />
  )
}

function MemberAccessTable({
  departments,
  members,
  onBulkSave,
  onSave,
  savingUserIds,
}: {
  departments: SettingsDepartment[]
  members: SettingsMember[]
  onBulkSave: (inputs: UpdateMemberInput[]) => Promise<boolean>
  onSave: (input: UpdateMemberInput) => Promise<void>
  savingUserIds: Set<string>
}) {
  const [drafts, setDrafts] = React.useState<Record<string, MemberDraft>>({})

  React.useEffect(() => {
    setDrafts(Object.fromEntries(members.map((member) => [member.userId, initialDraft(member)])))
  }, [members])

  function getDraft(member: SettingsMember) {
    return drafts[member.userId] ?? initialDraft(member)
  }

  function updateDraft(userId: string, update: Partial<MemberDraft>) {
    setDrafts((current) => {
      const member = members.find((candidate) => candidate.userId === userId)
      if (!member) {
        return current
      }

      const currentDraft = current[userId] ?? initialDraft(member)
      const nextDraft = { ...currentDraft, ...update }

      if (nextDraft.role === "owner") {
        nextDraft.departmentIds = []
      }

      return {
        ...current,
        [userId]: nextDraft,
      }
    })
  }

  function inputForMember(member: SettingsMember, patch?: BulkMemberPatch): UpdateMemberInput {
    const draft = getDraft(member)
    const role = patch?.role ?? draft.role
    const status = patch?.status ?? draft.status
    const departmentIds = role === "staff" ? (patch?.departmentIds ?? draft.departmentIds) : []

    return {
      departmentIds,
      role,
      status,
      userId: member.userId,
    }
  }

  const columns = React.useMemo<ColumnDef<SettingsMember>[]>(() => [
    {
      accessorFn: (member) => `${member.fullName} ${member.email}`,
      id: "user",
      header: "User",
      cell: ({ row }) => (
        <div className="min-w-44">
          <div className="truncate font-medium">{row.original.fullName}</div>
          <div className="truncate text-muted-foreground">{row.original.email}</div>
        </div>
      ),
      meta: { className: "min-w-56" },
    },
    {
      accessorFn: (member) => (member.memberId ? "member" : "pending"),
      id: "access",
      header: "Access",
      cell: ({ row }) => (
        <Badge variant={row.original.memberId ? "secondary" : "outline"}>
          {row.original.memberId ? "member" : "pending"}
        </Badge>
      ),
      meta: { className: "w-28" },
    },
    {
      accessorFn: (member) => getDraft(member).role,
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const draft = getDraft(row.original)

        return (
          <Select value={draft.role} onValueChange={(value) => updateDraft(row.original.userId, { role: value as MemberRole })}>
            <SelectTrigger className="h-7 w-32" aria-label={`Role for ${row.original.fullName}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
      meta: { className: "w-36" },
    },
    {
      accessorFn: (member) => getDraft(member).status,
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const draft = getDraft(row.original)

        return (
          <Select value={draft.status} onValueChange={(value) => updateDraft(row.original.userId, { status: value as MemberStatus })}>
            <SelectTrigger className="h-7 w-32" aria-label={`Status for ${row.original.fullName}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
      meta: { className: "w-36" },
    },
    {
      accessorFn: (member) => departmentSummary(departments, getDraft(member).role, getDraft(member).departmentIds),
      id: "departments",
      header: "Departments",
      cell: ({ row }) => {
        const draft = getDraft(row.original)

        return (
          <DepartmentDropdown
            departments={departments}
            disabled={draft.role === "owner"}
            departmentIds={draft.departmentIds}
            label={departmentSummary(departments, draft.role, draft.departmentIds)}
            onChange={(departmentIds) => updateDraft(row.original.userId, { departmentIds })}
          />
        )
      },
      meta: { className: "min-w-48" },
    },
    {
      id: "saved_status",
      header: "Saved",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={memberStatusVariant(row.original.status)}>{row.original.status ?? "not assigned"}</Badge>
        </div>
      ),
      meta: { className: "w-28" },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const draft = getDraft(row.original)
        const isDirty = memberIsDirty(row.original, draft)
        const isSaving = savingUserIds.has(row.original.userId)

        return (
          <Button
            disabled={isSaving || !isDirty}
            onClick={() => onSave(inputForMember(row.original))}
            size="sm"
          >
            {isSaving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            Save
          </Button>
        )
      },
      meta: { align: "right", className: "w-28" },
    },
  ], [departments, drafts, onSave, savingUserIds])

  async function applyBulkPatch(selectedMembers: SettingsMember[], patch: BulkMemberPatch) {
    const inputs = selectedMembers.map((member) => inputForMember(member, patch))
    const succeeded = await onBulkSave(inputs)

    if (succeeded) {
      setDrafts((current) => {
        const next = { ...current }

        for (const input of inputs) {
          next[input.userId] = {
            departmentIds: input.departmentIds,
            role: input.role,
            status: input.status,
          }
        }

        return next
      })
    }

    return succeeded
  }

  return (
    <DataTable
      bulkActions={(table) => (
        <MemberBulkActions
          departments={departments}
          onApply={applyBulkPatch}
          saving={savingUserIds.size > 0}
          table={table}
        />
      )}
      columns={columns}
      data={members}
      emptyMessage="No registered users found."
      enableRowSelection
      getRowId={(member) => member.userId}
      initialPageSize={10}
      pageSizeOptions={[5, 10, 20, 50]}
      searchPlaceholder="Search members"
      wide
    />
  )
}

function DepartmentDropdown({
  departments,
  departmentIds,
  disabled,
  label,
  onChange,
}: {
  departments: SettingsDepartment[]
  departmentIds: string[]
  disabled?: boolean
  label: string
  onChange: (departmentIds: string[]) => void
}) {
  function toggleDepartment(departmentId: string, checked: boolean) {
    if (checked) {
      onChange(departmentIds.includes(departmentId) ? departmentIds : [...departmentIds, departmentId])
      return
    }

    onChange(departmentIds.filter((id) => id !== departmentId))
  }

  if (disabled) {
    return <span className="text-xs text-muted-foreground">{label}</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="max-w-44 justify-start" />}>
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          {departments.map((department) => (
            <DropdownMenuCheckboxItem
              key={department.id}
              checked={departmentIds.includes(department.id)}
              onCheckedChange={(checked) => toggleDepartment(department.id, checked === true)}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: department.color }} />
              <span className="truncate">{department.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MemberBulkActions({
  departments,
  onApply,
  saving,
  table,
}: {
  departments: SettingsDepartment[]
  onApply: (selectedMembers: SettingsMember[], patch: BulkMemberPatch) => Promise<boolean>
  saving: boolean
  table: TanStackTable<SettingsMember>
}) {
  const selectedMembers = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
  const [applyRole, setApplyRole] = React.useState(false)
  const [applyStatus, setApplyStatus] = React.useState(false)
  const [applyDepartments, setApplyDepartments] = React.useState(false)
  const [role, setRole] = React.useState<MemberRole>("staff")
  const [status, setStatus] = React.useState<MemberStatus>("active")
  const [departmentIds, setDepartmentIds] = React.useState<string[]>([])

  if (selectedMembers.length === 0) {
    return null
  }

  async function applyBulkEdit() {
    const patch: BulkMemberPatch = {}

    if (applyRole) {
      patch.role = role
    }

    if (applyStatus) {
      patch.status = status
    }

    if (applyDepartments) {
      patch.departmentIds = departmentIds
    }

    if (!patch.role && !patch.status && !patch.departmentIds) {
      toast.error("Choose at least one bulk field to apply")
      return
    }

    const succeeded = await onApply(selectedMembers, patch)

    if (succeeded) {
      table.resetRowSelection()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
      <Badge variant="secondary">{selectedMembers.length} selected</Badge>
      <Label className="gap-1 font-normal">
        <Checkbox checked={applyRole} onCheckedChange={(checked) => setApplyRole(checked === true)} />
        Role
      </Label>
      <Select value={role} onValueChange={(value) => setRole(value as MemberRole)}>
        <SelectTrigger className="h-7 w-28" aria-label="Bulk role" disabled={!applyRole}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Label className="gap-1 font-normal">
        <Checkbox checked={applyStatus} onCheckedChange={(checked) => setApplyStatus(checked === true)} />
        Status
      </Label>
      <Select value={status} onValueChange={(value) => setStatus(value as MemberStatus)}>
        <SelectTrigger className="h-7 w-28" aria-label="Bulk status" disabled={!applyStatus}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Label className="gap-1 font-normal">
        <Checkbox checked={applyDepartments} onCheckedChange={(checked) => setApplyDepartments(checked === true)} />
        Departments
      </Label>
      <DepartmentDropdown
        departments={departments}
        departmentIds={departmentIds}
        disabled={!applyDepartments || (applyRole && role === "owner")}
        label={departmentSummary(departments, "staff", departmentIds)}
        onChange={setDepartmentIds}
      />
      <Button disabled={saving} onClick={applyBulkEdit} size="sm">
        {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
        Apply bulk
      </Button>
    </div>
  )
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCogIcon className="size-4 shrink-0" />
            Member access control
          </CardTitle>
          <CardDescription>
            Signed-up users stay pending until an owner assigns organization status, role, and staff department scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberAccessManager />
        </CardContent>
      </Card>
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
