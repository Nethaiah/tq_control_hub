"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef, PaginationState, SortingState, Table as TanStackTable } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AlertTriangleIcon, ArchiveIcon, Loader2Icon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react"

import { ConfirmDialog, type ConfirmDialogState } from "@/components/common/confirm-dialog"
import { DataTable } from "@/components/common/data-table"
import { DatePicker } from "@/components/common/date-picker"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import { RenameDialog, type RenameDialogState } from "@/components/common/rename-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { categoryFormSchema } from "@/domain/schemas"
import type { Category, CategoryFormValues, Client, Department, RecurringItem } from "@/domain/types"
import { readApiResponse } from "@/features/metrics/api-client"
import { useRecurringItemsUrlState } from "@/hooks/use-recurring-items-url-state"

type CategoriesData = {
  categories: Category[]
}

type RecurringItemsData = {
  categories: Category[]
  clients: Client[]
  departments: Department[]
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
  recurringItems: RecurringItem[]
}

type RecurringItemsApiFilters = {
  categoryId?: string
  departmentId?: string
  page: number
  pageSize: number
  search?: string
  sortBy?: string
  sortDir?: "asc" | "desc"
  type?: "revenue" | "expense"
}

type RecurringItemInput = {
  amount: number
  cadence: "monthly" | "quarterly" | "annual"
  categoryId: string
  clientId?: string | null
  currency: "USD" | "AED"
  departmentId: string
  nextRun: string
  subcategoryId?: string | null
  template: string
  type: "revenue" | "expense"
  vendor?: string | null
}

type RecurringDraft = {
  amount: string
  cadence: "monthly" | "quarterly" | "annual"
  categoryId: string
  clientId: string
  currency: "USD" | "AED"
  departmentId: string
  nextRun: string
  subcategoryId: string
  template: string
  type: "revenue" | "expense"
  vendor: string
}

type RenameTarget = {
  kind: "category" | "subcategory" | "rule" | "mapping" | "template"
  id?: string
  index?: number
  initialValue: string
}

type ArchiveTarget = {
  kind: "category" | "subcategory" | "rule" | "mapping" | "template" | "bulk-templates"
  id?: string
  index?: number
  ids?: string[]
  label: string
}

const categoriesQueryKey = ["categories"] as const
const recurringItemsQueryRoot = ["recurring-items"] as const
const recurringItemsQueryKey = (filters: RecurringItemsApiFilters) => [...recurringItemsQueryRoot, filters] as const

async function fetchCategories() {
  const response = await fetch("/api/categories", { credentials: "same-origin" })
  return readApiResponse<CategoriesData>(response, "Unable to load categories")
}

async function fetchRecurringItems(filters: RecurringItemsApiFilters) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  }

  const query = params.toString()
  const response = await fetch(query ? `/api/recurring-items?${query}` : "/api/recurring-items", { credentials: "same-origin" })
  return readApiResponse<RecurringItemsData>(response, "Unable to load recurring templates")
}

async function createCategoryApi(input: CategoryFormValues) {
  const response = await fetch("/api/categories", {
    body: JSON.stringify({
      kind: input.kind,
      name: input.name,
      parentId: input.parentId || null,
    }),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  return readApiResponse<{ category: Category }>(response, "Unable to add category")
}

async function updateCategoryApi(input: { id: string; patch: Partial<Pick<Category, "archived" | "name" | "parentId">> }) {
  const response = await fetch(`/api/categories/${encodeURIComponent(input.id)}`, {
    body: JSON.stringify(input.patch),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  })

  return readApiResponse<{ category: Category }>(response, "Unable to update category")
}

async function createRecurringItemApi(input: RecurringItemInput) {
  const response = await fetch("/api/recurring-items", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  return readApiResponse<{ recurringItem: RecurringItem }>(response, "Unable to add recurring template")
}

async function updateRecurringItemApi(input: { id: string; patch: Partial<RecurringItemInput & { active: boolean }> }) {
  const response = await fetch(`/api/recurring-items/${encodeURIComponent(input.id)}`, {
    body: JSON.stringify(input.patch),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  })

  return readApiResponse<{ recurringItem: RecurringItem }>(response, "Unable to update recurring template")
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount)
}

function categoryName(categories: Category[], id: string | null) {
  return categories.find((category) => category.id === id)?.name ?? "Unassigned"
}

function departmentName(departments: Department[], id: string) {
  return departments.find((department) => department.id === id)?.name ?? "Unknown department"
}

function clientName(clients: Client[], id: string | null) {
  return id ? clients.find((client) => client.id === id)?.name ?? "Unknown client" : null
}

function displayLabel(value: string, fallback: string) {
  return value.length > 0 && value !== "none" ? value : fallback
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function emptyRecurringDraft(): RecurringDraft {
  return {
    amount: "",
    cadence: "monthly",
    categoryId: "",
    clientId: "none",
    currency: "USD",
    departmentId: "",
    nextRun: "2026-07-05",
    subcategoryId: "none",
    template: "Retainer, {month}",
    type: "revenue",
    vendor: "",
  }
}

function CategoryList({
  title,
  categories,
  allCategories,
  onRenameCategory,
  onArchiveCategory,
  onRenameSubcategory,
  onArchiveSubcategory,
}: {
  title: string
  categories: Category[]
  allCategories: Category[]
  onRenameCategory: (id: string, name: string) => void
  onArchiveCategory: (id: string, name: string) => void
  onRenameSubcategory: (id: string, name: string) => void
  onArchiveSubcategory: (id: string, name: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Categories and subcategories are data, not UI constants.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {categories.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No active categories.</div>
        ) : null}
        {categories.map((category) => {
          const children = allCategories.filter((item) => item.parentId === category.id && !item.archived)

          return (
            <div key={category.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{category.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {children.map((child) => (
                      <Badge key={child.id} variant="outline">
                        {child.name}
                        <button
                          type="button"
                          className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3"
                          aria-label={`Rename ${child.name}`}
                          onClick={() => onRenameSubcategory(child.id, child.name)}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3"
                          aria-label={`Archive ${child.name}`}
                          onClick={() => onArchiveSubcategory(child.id, child.name)}
                        >
                          <ArchiveIcon />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Rename ${category.name}`} onClick={() => onRenameCategory(category.id, category.name)}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Archive ${category.name}`} onClick={() => onArchiveCategory(category.id, category.name)}>
                    <ArchiveIcon />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function CategorySettings() {
  const queryClient = useQueryClient()
  const [recurringUrlState, recurringUrlSetters] = useRecurringItemsUrlState()
  const recurringApiFilters: RecurringItemsApiFilters = {
    categoryId: recurringUrlState.categoryId ?? undefined,
    departmentId: recurringUrlState.departmentId ?? undefined,
    page: recurringUrlState.page,
    pageSize: recurringUrlState.pageSize,
    search: recurringUrlState.search ?? undefined,
    sortBy: recurringUrlState.sortBy ?? undefined,
    sortDir: recurringUrlState.sortDir ?? undefined,
    type: recurringUrlState.type ?? undefined,
  }
  const categoriesQuery = useQuery({ queryFn: fetchCategories, queryKey: categoriesQueryKey })
  const recurringItemsQuery = useQuery({
    queryFn: () => fetchRecurringItems(recurringApiFilters),
    queryKey: recurringItemsQueryKey(recurringApiFilters),
  })
  const createCategoryMutation = useMutation({
    mutationFn: createCategoryApi,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to add category"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: recurringItemsQueryRoot }),
      ])
      toast.success("Category added")
    },
  })
  const updateCategoryMutation = useMutation({
    mutationFn: updateCategoryApi,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update category"),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: recurringItemsQueryRoot }),
      ])
      toast.success(variables.patch.archived ? "Category archived" : "Category updated")
    },
  })
  const createRecurringItemMutation = useMutation({
    mutationFn: createRecurringItemApi,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to add recurring template"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recurringItemsQueryRoot })
      toast.success("Recurring template added")
    },
  })
  const updateRecurringItemMutation = useMutation({
    mutationFn: updateRecurringItemApi,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update recurring template"),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: recurringItemsQueryRoot })
      toast.success(variables.patch.active === false ? "Recurring template archived" : "Recurring template updated")
    },
  })

  const [categorizationRules, setCategorizationRules] = React.useState([
    "If vendor contains Meta, set Marketing / Marketing & ad spend / Meta.",
    "If description contains Claude, set Development / Software & subscriptions / AI usage.",
    "If amount is AED and vendor is Accountant, require human review.",
  ])
  const [csvMappingRules, setCsvMappingRules] = React.useState([
    "Date -> date",
    "Memo -> description",
    "Debit -> amount",
    "Currency -> currency",
  ])
  const [ruleDraft, setRuleDraft] = React.useState("")
  const [mappingDraft, setMappingDraft] = React.useState("")
  const [recurringDraft, setRecurringDraft] = React.useState<RecurringDraft>(() => emptyRecurringDraft())
  const [addCategoryOpen, setAddCategoryOpen] = React.useState(false)
  const [renameTarget, setRenameTarget] = React.useState<RenameTarget | null>(null)
  const [archiveTarget, setArchiveTarget] = React.useState<ArchiveTarget | null>(null)

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema as never) as never,
    defaultValues: { kind: "expense", name: "", parentId: "" },
  })
  const kind = form.watch("kind")

  React.useEffect(() => {
    if (!categoriesQuery.data || !recurringItemsQuery.data) return

    setRecurringDraft((current) => {
      const next = { ...current }
      const department = recurringItemsQuery.data.departments[0]
      const category = categoriesQuery.data.categories.find(
        (item) => item.kind === current.type && item.parentId === null && !item.archived
      )

      if (!next.departmentId && department) {
        next.departmentId = department.id
      }

      if (!next.categoryId && category) {
        next.categoryId = category.id
      }

      return next.departmentId === current.departmentId && next.categoryId === current.categoryId ? current : next
    })
  }, [categoriesQuery.data, recurringItemsQuery.data, recurringDraft.categoryId, recurringDraft.departmentId, recurringDraft.type])

  if (categoriesQuery.isPending || recurringItemsQuery.isPending) {
    return (
      <PageShell>
        <PageHeader title="Category settings" description="Manage category taxonomy and recurring item templates." />
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading category settings...
        </div>
      </PageShell>
    )
  }

  if (categoriesQuery.isError || recurringItemsQuery.isError) {
    const error = categoriesQuery.error ?? recurringItemsQuery.error

    return (
      <PageShell>
        <PageHeader title="Category settings" description="Manage category taxonomy and recurring item templates." />
        <Alert variant="destructive">
          <AlertTriangleIcon className="size-4 shrink-0" />
          <AlertTitle>Category settings unavailable</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Unable to load category settings."}</AlertDescription>
        </Alert>
      </PageShell>
    )
  }

  const categories = categoriesQuery.data.categories
  const recurringData = recurringItemsQuery.data
  const rootRevenue = categories.filter((category) => category.kind === "revenue" && category.parentId === null && !category.archived)
  const rootExpense = categories.filter((category) => category.kind === "expense" && category.parentId === null && !category.archived)
  const parentOptions = categories.filter((category) => category.kind === kind && category.parentId === null && !category.archived)
  const recurringRootCategories = categories.filter((category) => category.kind === recurringDraft.type && category.parentId === null && !category.archived)
  const recurringSubcategories = categories.filter((category) => category.parentId === recurringDraft.categoryId && !category.archived)
  const selectedRecurringCategory = categories.find((category) => category.id === recurringDraft.categoryId)
  const selectedRecurringDepartmentLabel = recurringDraft.departmentId ? departmentName(recurringData.departments, recurringDraft.departmentId) : "Choose department"
  const selectedRecurringCategoryLabel = recurringDraft.categoryId ? categoryName(categories, recurringDraft.categoryId) : "Choose category"
  const selectedRecurringSubcategoryLabel = recurringDraft.subcategoryId !== "none" ? categoryName(categories, recurringDraft.subcategoryId) : "No subcategory"
  const selectedRecurringClientLabel = recurringDraft.clientId !== "none" ? (clientName(recurringData.clients, recurringDraft.clientId) ?? "Unknown client") : "No client"
  const selectedFilterDepartmentLabel = recurringUrlState.departmentId ? departmentName(recurringData.departments, recurringUrlState.departmentId) : "All departments"
  const selectedFilterCategoryLabel = recurringUrlState.categoryId ? categoryName(categories, recurringUrlState.categoryId) : "All categories"
  const recurringTablePagination: PaginationState = {
    pageIndex: recurringUrlState.page - 1,
    pageSize: recurringUrlState.pageSize,
  }
  const recurringTableSorting: SortingState = recurringUrlState.sortBy
    ? [{ desc: recurringUrlState.sortDir === "desc", id: recurringUrlState.sortBy }]
    : []

  async function onSubmit(values: CategoryFormValues) {
    await createCategoryMutation.mutateAsync(values)
    form.reset({ kind: values.kind, name: "", parentId: "" })
    setAddCategoryOpen(false)
  }

  function updateRecurringDraft(patch: Partial<RecurringDraft>) {
    setRecurringDraft((current) => ({ ...current, ...patch }))
  }

  async function addRecurringTemplate() {
    const amount = Number(recurringDraft.amount)

    if (!recurringDraft.template.trim() || !recurringDraft.nextRun || !amount || amount <= 0) {
      toast.error("Add a template, next run date, and amount above zero")
      return
    }

    if (!recurringDraft.departmentId || !recurringDraft.categoryId) {
      toast.error("Choose a department and category")
      return
    }

    await createRecurringItemMutation.mutateAsync({
      amount,
      cadence: recurringDraft.cadence,
      categoryId: recurringDraft.categoryId,
      clientId: recurringDraft.type === "revenue" && recurringDraft.clientId !== "none" ? recurringDraft.clientId : null,
      currency: recurringDraft.currency,
      departmentId: recurringDraft.departmentId,
      nextRun: recurringDraft.nextRun,
      subcategoryId: recurringDraft.subcategoryId !== "none" ? recurringDraft.subcategoryId : null,
      template: recurringDraft.template.trim(),
      type: recurringDraft.type,
      vendor: recurringDraft.type === "expense" ? recurringDraft.vendor.trim() || null : null,
    })
    setRecurringDraft(emptyRecurringDraft())
  }

  function handleRenameConfirm(value: string) {
    if (!renameTarget) return

    switch (renameTarget.kind) {
      case "category":
      case "subcategory":
        void updateCategoryMutation.mutateAsync({ id: renameTarget.id!, patch: { name: value } })
        break
      case "rule":
        setCategorizationRules((current) => current.map((item, index) => index === renameTarget.index ? value : item))
        toast.success("Categorization rule updated")
        break
      case "mapping":
        setCsvMappingRules((current) => current.map((item, index) => index === renameTarget.index ? value : item))
        toast.success("CSV mapping rule updated")
        break
      case "template":
        void updateRecurringItemMutation.mutateAsync({ id: renameTarget.id!, patch: { template: value } })
        break
    }
  }

  function handleArchiveConfirm() {
    if (!archiveTarget) return

    switch (archiveTarget.kind) {
      case "category":
      case "subcategory":
        void updateCategoryMutation.mutateAsync({ id: archiveTarget.id!, patch: { archived: true } })
        break
      case "rule":
        setCategorizationRules((current) => current.filter((_, index) => index !== archiveTarget.index))
        toast("Categorization rule archived")
        break
      case "mapping":
        setCsvMappingRules((current) => current.filter((_, index) => index !== archiveTarget.index))
        toast("CSV mapping rule archived")
        break
      case "template":
        void updateRecurringItemMutation.mutateAsync({ id: archiveTarget.id!, patch: { active: false } })
        break
      case "bulk-templates":
        void Promise.all(archiveTarget.ids!.map((id) => updateRecurringItemMutation.mutateAsync({ id, patch: { active: false } })))
        break
    }
  }

  const recurringColumns: ColumnDef<RecurringItem>[] = [
    {
      accessorKey: "template",
      header: "Template",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{row.original.template}</span>
            <Badge variant={row.original.type === "revenue" ? "secondary" : "outline"}>{row.original.type}</Badge>
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{row.original.idempotencyKey}</div>
        </div>
      ),
      meta: { className: "min-w-64" },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatMoney(row.original.amount, row.original.currency),
      meta: { className: "w-24" },
    },
    {
      id: "classification",
      accessorFn: (row) => `${departmentName(recurringData.departments, row.departmentId)} ${categoryName(categories, row.categoryId)}`,
      header: "Classification",
      cell: ({ row }) => {
        const counterparty = row.original.type === "revenue"
          ? clientName(recurringData.clients, row.original.clientId)
          : row.original.vendor

        return (
          <div className="min-w-0 text-xs">
            <div className="truncate font-medium">{departmentName(recurringData.departments, row.original.departmentId)}</div>
            <div className="truncate text-muted-foreground">{categoryName(categories, row.original.categoryId)}</div>
            {counterparty ? <div className="truncate text-muted-foreground">{counterparty}</div> : null}
          </div>
        )
      },
      meta: { className: "min-w-44" },
    },
    {
      id: "schedule",
      accessorFn: (row) => `${row.nextRun} ${row.cadence}`,
      header: "Schedule",
      cell: ({ row }) => (
        <div className="text-xs">
          <div className="font-medium">{row.original.nextRun}</div>
          <div className="text-muted-foreground">{row.original.cadence}</div>
        </div>
      ),
      meta: { className: "w-28" },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original

        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label={`Rename ${item.template}`} onClick={() => setRenameTarget({ kind: "template", id: item.id, initialValue: item.template })}>
              <PencilIcon />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Archive ${item.template}`} onClick={() => setArchiveTarget({ kind: "template", id: item.id, label: item.template })}>
              <TrashIcon />
            </Button>
          </div>
        )
      },
      meta: { align: "right", className: "w-20" },
    },
  ]

  function RecurringBulkActions(table: TanStackTable<RecurringItem>) {
    const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id)

    return (
      <Button
        variant="outline"
        disabled={selectedIds.length === 0}
        onClick={() => setArchiveTarget({ kind: "bulk-templates", ids: selectedIds, label: `${selectedIds.length} recurring templates` })}
      >
        Archive {selectedIds.length} selected
      </Button>
    )
  }

  const renameDialogState: RenameDialogState = renameTarget ? { open: true, initialValue: renameTarget.initialValue } : null
  const archiveDialogState: ConfirmDialogState = archiveTarget ? { open: true } : null
  const mutationsPending = createCategoryMutation.isPending || updateCategoryMutation.isPending || createRecurringItemMutation.isPending || updateRecurringItemMutation.isPending

  return (
    <PageShell>
      <PageHeader
        title="Category settings"
        description="Manage revenue and expense categories, rules, recurring templates, and CSV mapping defaults as configurable data."
        actions={(
          <Button onClick={() => setAddCategoryOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Add category
          </Button>
        )}
      />

      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add category</DialogTitle>
            <DialogDescription>
              Create a root category or subcategory. Owner-only taxonomy changes persist through the backend API.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="category-name">Name</FieldLabel>
                <Input id="category-name" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field>
                <FieldLabel>Kind</FieldLabel>
                <Select value={kind} onValueChange={(value) => form.setValue("kind", (value ?? "expense") as "revenue" | "expense")}>
                  <SelectTrigger className="w-full" aria-label="Kind">
                    <SelectValue>{titleCase(kind)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Parent category</FieldLabel>
                <Select value={form.watch("parentId") || "root"} onValueChange={(value) => form.setValue("parentId", value === "root" ? "" : (value ?? ""))}>
                  <SelectTrigger className="w-full" aria-label="Parent category">
                    <SelectValue>{form.watch("parentId") ? categoryName(categories, form.watch("parentId") ?? null) : "Root category"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="root">Root category</SelectItem>
                      {parentOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAddCategoryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCategoryMutation.isPending}>
                {createCategoryMutation.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
                Add category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <RenameDialog
        state={renameDialogState}
        onOpenChange={(state) => {
          if (!state) setRenameTarget(null)
        }}
        title={renameTarget ? (renameTarget.kind === "template" ? "Edit recurring template" : `Rename ${renameTarget.kind}`) : "Rename"}
        label={renameTarget?.kind === "template" ? "Template" : "Name"}
        confirmLabel="Save"
        onConfirm={handleRenameConfirm}
      />

      <ConfirmDialog
        state={archiveDialogState}
        onOpenChange={(state) => {
          if (!state) setArchiveTarget(null)
        }}
        title="Archive"
        description={archiveTarget ? `Are you sure you want to archive ${archiveTarget.label}? Historical rows keep stable IDs.` : ""}
        confirmLabel="Archive"
        destructive
        onConfirm={handleArchiveConfirm}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <CategoryList
          title="Revenue categories"
          categories={rootRevenue}
          allCategories={categories}
          onRenameCategory={(id, name) => setRenameTarget({ kind: "category", id, initialValue: name })}
          onArchiveCategory={(id, name) => setArchiveTarget({ kind: "category", id, label: name })}
          onRenameSubcategory={(id, name) => setRenameTarget({ kind: "subcategory", id, initialValue: name })}
          onArchiveSubcategory={(id, name) => setArchiveTarget({ kind: "subcategory", id, label: name })}
        />
        <CategoryList
          title="Expense categories"
          categories={rootExpense}
          allCategories={categories}
          onRenameCategory={(id, name) => setRenameTarget({ kind: "category", id, initialValue: name })}
          onArchiveCategory={(id, name) => setArchiveTarget({ kind: "category", id, label: name })}
          onRenameSubcategory={(id, name) => setRenameTarget({ kind: "subcategory", id, initialValue: name })}
          onArchiveSubcategory={(id, name) => setArchiveTarget({ kind: "subcategory", id, label: name })}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.7fr_2fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Categorization rules</CardTitle>
            <CardDescription>Human-readable rules stay local until Phase 6 import rules are operational.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            <div className="flex gap-2">
              <Input value={ruleDraft} onChange={(event) => setRuleDraft(event.target.value)} placeholder="If vendor contains Vercel, set Software & subscriptions > infrastructure" />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!ruleDraft.trim()) return
                  setCategorizationRules((current) => [...current, ruleDraft.trim()])
                  setRuleDraft("")
                  toast.success("Categorization rule added")
                }}
              >
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
            {categorizationRules.map((rule, index) => (
              <div key={rule} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <span>{rule}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Rename categorization rule" onClick={() => setRenameTarget({ kind: "rule", index, initialValue: rule })}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Archive categorization rule" onClick={() => setArchiveTarget({ kind: "rule", index, label: "this categorization rule" })}>
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recurring templates</CardTitle>
            <CardDescription>Templates persist with stable idempotency keys and never directly post ledger rows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-2 2xl:grid-cols-4">
              <Field>
                <FieldLabel>Template</FieldLabel>
                <Input value={recurringDraft.template} onChange={(event) => updateRecurringDraft({ template: event.target.value })} />
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                  <Select value={recurringDraft.type} onValueChange={(value) => updateRecurringDraft({ categoryId: "", clientId: "none", subcategoryId: "none", type: (value ?? "revenue") as "revenue" | "expense", vendor: "" })}>
                  <SelectTrigger className="w-full" aria-label="Recurring type"><SelectValue>{titleCase(recurringDraft.type)}</SelectValue></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Amount</FieldLabel>
                <Input inputMode="decimal" value={recurringDraft.amount} onChange={(event) => updateRecurringDraft({ amount: event.target.value })} placeholder="4000" />
              </Field>
              <Field>
                <FieldLabel>Currency</FieldLabel>
                <Select value={recurringDraft.currency} onValueChange={(value) => updateRecurringDraft({ currency: (value ?? "USD") as "USD" | "AED" })}>
                  <SelectTrigger className="w-full" aria-label="Recurring currency"><SelectValue>{recurringDraft.currency}</SelectValue></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="USD">USD</SelectItem><SelectItem value="AED">AED</SelectItem></SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Cadence</FieldLabel>
                <Select value={recurringDraft.cadence} onValueChange={(value) => updateRecurringDraft({ cadence: (value ?? "monthly") as "monthly" | "quarterly" | "annual" })}>
                  <SelectTrigger className="w-full" aria-label="Recurring cadence"><SelectValue>{titleCase(recurringDraft.cadence)}</SelectValue></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Next run</FieldLabel>
                <DatePicker value={recurringDraft.nextRun} onChange={(value) => updateRecurringDraft({ nextRun: value })} />
              </Field>
              <Field>
                <FieldLabel>Department</FieldLabel>
                <Select value={recurringDraft.departmentId || "none"} onValueChange={(value) => updateRecurringDraft({ departmentId: value && value !== "none" ? value : "" })}>
                  <SelectTrigger className="w-full" aria-label="Recurring department"><SelectValue>{displayLabel(selectedRecurringDepartmentLabel, "Choose department")}</SelectValue></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="none">Choose department</SelectItem>{recurringData.departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Category</FieldLabel>
                <Select value={recurringDraft.categoryId || "none"} onValueChange={(value) => updateRecurringDraft({ categoryId: value && value !== "none" ? value : "", subcategoryId: "none" })}>
                  <SelectTrigger className="w-full" aria-label="Recurring category"><SelectValue>{displayLabel(selectedRecurringCategoryLabel, "Choose category")}</SelectValue></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="none">Choose category</SelectItem>{recurringRootCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Subcategory</FieldLabel>
                <Select disabled={!selectedRecurringCategory || recurringSubcategories.length === 0} value={recurringDraft.subcategoryId || "none"} onValueChange={(value) => updateRecurringDraft({ subcategoryId: value ?? "none" })}>
                  <SelectTrigger className="w-full" aria-label="Recurring subcategory"><SelectValue>{selectedRecurringSubcategoryLabel}</SelectValue></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="none">No subcategory</SelectItem>{recurringSubcategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              {recurringDraft.type === "revenue" ? (
                <Field>
                  <FieldLabel>Client</FieldLabel>
                  <Select value={recurringDraft.clientId} onValueChange={(value) => updateRecurringDraft({ clientId: value ?? "none" })}>
                    <SelectTrigger className="w-full" aria-label="Recurring client"><SelectValue>{selectedRecurringClientLabel}</SelectValue></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="none">No client</SelectItem>{recurringData.clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field>
                  <FieldLabel>Vendor</FieldLabel>
                  <Input value={recurringDraft.vendor} onChange={(event) => updateRecurringDraft({ vendor: event.target.value })} placeholder="Vendor name" />
                </Field>
              )}
              <div className="flex items-end md:justify-end 2xl:col-start-4">
                <Button type="button" size="sm" className="w-full md:w-auto" disabled={createRecurringItemMutation.isPending} onClick={addRecurringTemplate}>
                  {createRecurringItemMutation.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
                  Add template
                </Button>
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-4">
              <Field>
                <FieldLabel>Table type</FieldLabel>
                <Select value={recurringUrlState.type ?? "all"} onValueChange={(value) => recurringUrlSetters.setType(value === "all" ? null : (value as "revenue" | "expense"))}>
                  <SelectTrigger className="w-full" aria-label="Filter recurring type">
                    <SelectValue>{recurringUrlState.type ? titleCase(recurringUrlState.type) : "All types"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Table department</FieldLabel>
                <Select value={recurringUrlState.departmentId ?? "all"} onValueChange={(value) => recurringUrlSetters.setDepartmentId(value === "all" ? null : value)}>
                  <SelectTrigger className="w-full" aria-label="Filter recurring department">
                    <SelectValue>{selectedFilterDepartmentLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All departments</SelectItem>
                      {recurringData.departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Table category</FieldLabel>
                <Select value={recurringUrlState.categoryId ?? "all"} onValueChange={(value) => recurringUrlSetters.setCategoryId(value === "all" ? null : value)}>
                  <SelectTrigger className="w-full" aria-label="Filter recurring category">
                    <SelectValue>{selectedFilterCategoryLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.filter((category) => !category.archived).map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end">
                <Button type="button" variant="outline" className="w-full" onClick={recurringUrlSetters.resetFilters}>
                  Reset table filters
                </Button>
              </div>
            </div>
            <DataTable
              data={recurringData.recurringItems}
              columns={recurringColumns}
              getRowId={(row) => row.id}
              enableRowSelection
              bulkActions={RecurringBulkActions}
              searchPlaceholder="Search recurring templates"
              initialPageSize={5}
              serverSide
              pageCount={recurringData.pagination.totalPages}
              totalRows={recurringData.pagination.totalRows}
              controlledPagination={recurringTablePagination}
              controlledSorting={recurringTableSorting}
              controlledSearch={recurringUrlState.search ?? ""}
              onPaginationChange={recurringUrlSetters.setPagination}
              onSortingChange={recurringUrlSetters.setSorting}
              onSearchChange={recurringUrlSetters.setSearch}
              wide
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSV mapping rules</CardTitle>
            <CardDescription>Saved mappings become operational in Phase 6 CSV import pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            <div className="flex gap-2">
              <Input value={mappingDraft} onChange={(event) => setMappingDraft(event.target.value)} placeholder="Amount Paid -> amount" />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!mappingDraft.trim()) return
                  setCsvMappingRules((current) => [...current, mappingDraft.trim()])
                  setMappingDraft("")
                  toast.success("CSV mapping rule added")
                }}
              >
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
            {csvMappingRules.map((rule, index) => (
              <div key={rule} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <span>{rule}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Rename CSV mapping rule" onClick={() => setRenameTarget({ kind: "mapping", index, initialValue: rule })}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Archive CSV mapping rule" onClick={() => setArchiveTarget({ kind: "mapping", index, label: "this CSV mapping rule" })}>
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {mutationsPending ? <div className="sr-only" aria-live="polite">Saving category settings</div> : null}
    </PageShell>
  )
}
