"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef, PaginationState, SortingState, Table as TanStackTable } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AlertTriangleIcon, Loader2Icon, PlusIcon, RotateCcwIcon, SearchIcon, XIcon } from "lucide-react"

import { DataTable } from "@/components/common/data-table"
import { DatePicker } from "@/components/common/date-picker"
import { FiltersDialog } from "@/components/common/filters-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { formatCurrency } from "@/domain/currency"
import { activeFilterCount } from "@/domain/filters"
import { manualTransactionFormSchema } from "@/domain/schemas"
import type {
  Category,
  Client,
  Department,
  ManualTransactionFormValues,
  Transaction,
  TransactionFilters,
} from "@/domain/types"
import { useLedgerUrlState } from "@/hooks/use-ledger-url-state"
import { titleCase } from "@/lib/format"

type LedgerTotals = {
  revenueUsd: number
  expenseUsd: number
  netProfitUsd: number
  rowCount: number
  transactionIds: string[]
}

type LedgerPagination = {
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
}

type LedgerData = {
  categories: Category[]
  clients: Client[]
  departments: Department[]
  rows: Transaction[]
  totals: LedgerTotals
  pagination: LedgerPagination
}

type LedgerApiFilters = TransactionFilters & {
  page: number
  pageSize: number
  sortBy?: string
  sortDir?: "asc" | "desc"
}

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } }

type UpdateTransactionInput = {
  id: string
  patch: Partial<Transaction>
}

type BulkUpdateTransactionInput = {
  categoryId: string
  departmentId: string
  ids: string[]
  subcategoryId?: string | null
}

const transactionsQueryKey = (filters: LedgerApiFilters) => ["transactions", filters] as const

async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload && !payload.ok ? payload.error.message : fallbackMessage)
  }

  return payload.data
}

async function fetchLedgerData(filters: LedgerApiFilters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  }
  const query = params.toString()
  const response = await fetch(query ? `/api/transactions?${query}` : "/api/transactions", {
    credentials: "same-origin",
  })

  return readApiResponse<LedgerData>(response, "Unable to load ledger data")
}

async function createLedgerTransaction(input: ManualTransactionFormValues) {
  const response = await fetch("/api/transactions", {
    body: JSON.stringify({
      amount: input.amount,
      categoryId: input.categoryId,
      clientId: input.clientId || null,
      currency: input.currency,
      date: input.date,
      departmentId: input.departmentId,
      description: input.description,
      source: "manual",
      subcategoryId: input.subcategoryId || null,
      type: input.type,
      vendor: input.vendor || null,
    }),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  return readApiResponse<{ transaction: Transaction }>(response, "Unable to create transaction")
}

async function updateLedgerTransaction(input: UpdateTransactionInput) {
  const response = await fetch(`/api/transactions/${encodeURIComponent(input.id)}`, {
    body: JSON.stringify(input.patch),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  })

  return readApiResponse<{ transaction: Transaction }>(response, "Unable to update transaction")
}

async function bulkUpdateLedgerTransactions(input: BulkUpdateTransactionInput) {
  const response = await fetch("/api/transactions/bulk", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  })

  return readApiResponse<{ transactions: Transaction[] }>(response, "Unable to bulk update transactions")
}

function withRows(data: LedgerData, rows: Transaction[]): LedgerData {
  return {
    ...data,
    rows,
  }
}

function nameById<T extends { id: string; name: string }>(items: T[], id: string | null) {
  if (!id) {
    return "-"
  }

  return items.find((item) => item.id === id)?.name ?? "Unmapped"
}

function SelectFilter({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string
  value?: string
  onValueChange: (value?: string) => void
  options: Array<{ value: string; label: string }>
}) {
  const allOptions = React.useMemo(() => [{ value: "", label: "All" }, ...options], [options])
  const currentValue = value ?? ""
  const currentLabel = allOptions.find((option) => option.value === currentValue)?.label ?? "All"

  return (
    <Field className="min-w-36">
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={currentValue}
        onValueChange={(next) => onValueChange(next || undefined)}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <span className="line-clamp-1 flex-1 text-left">{currentLabel}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {allOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function FilterChips({
  filters,
  departments,
  categories,
  clients,
  onRemove,
  onReset,
}: {
  filters: TransactionFilters
  departments: Department[]
  categories: Category[]
  clients: Client[]
  onRemove: (key: keyof TransactionFilters) => void
  onReset: () => void
}) {
  const chips: Array<{ key: keyof TransactionFilters; label: string }> = []

  if (filters.from) chips.push({ key: "from", label: `From ${filters.from}` })
  if (filters.to) chips.push({ key: "to", label: `To ${filters.to}` })
  if (filters.type) chips.push({ key: "type", label: titleCase(filters.type) })
  if (filters.departmentId) {
    chips.push({ key: "departmentId", label: nameById(departments, filters.departmentId) })
  }
  if (filters.categoryId) {
    chips.push({ key: "categoryId", label: nameById(categories, filters.categoryId) })
  }
  if (filters.clientOrVendor) {
    chips.push({
      key: "clientOrVendor",
      label:
        clients.find((client) => client.id === filters.clientOrVendor)?.name ??
        filters.clientOrVendor,
    })
  }
  if (filters.search) chips.push({ key: "search", label: `Search: ${filters.search}` })
  if (filters.source) chips.push({ key: "source", label: `Source: ${filters.source}` })
  if (filters.ids) {
    const count = filters.ids.split(",").filter(Boolean).length
    chips.push({ key: "ids", label: `Exact source rows: ${count}` })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Badge key={`${chip.key}-${chip.label}`} variant="outline" className="gap-1.5">
          {chip.label}
          <button
            type="button"
            className="inline-flex size-3.5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(chip.key)}
            aria-label={`Remove ${chip.label}`}
          >
            <XIcon className="size-2.5" />
          </button>
        </Badge>
      ))}
      {chips.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcwIcon data-icon="inline-start" />
          Reset filters
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">No filters beyond the June owner view.</span>
      )}
    </div>
  )
}

function ManualTransactionSheet({
  departments,
  categories,
  clients,
  onAdd,
  isAdding,
}: {
  departments: Department[]
  categories: Category[]
  clients: Client[]
  onAdd: (values: ManualTransactionFormValues) => Promise<void> | void
  isAdding: boolean
}) {
  const form = useForm<ManualTransactionFormValues>({
    resolver: zodResolver(manualTransactionFormSchema as never) as never,
    defaultValues: {
      date: "2026-06-26",
      type: "expense",
      description: "",
      amount: 0,
      currency: "USD",
      departmentId: "",
      categoryId: "",
      subcategoryId: "",
      clientId: "",
      vendor: "",
    },
  })
  const transactionType = form.watch("type")
  const availableCategories = categories.filter(
    (category) => category.kind === transactionType && category.parentId === null && !category.archived
  )

  React.useEffect(() => {
    if (!form.getValues("departmentId") && departments[0]) {
      form.setValue("departmentId", departments[0].id)
    }
  }, [departments, form])

  React.useEffect(() => {
    const currentCategoryId = form.getValues("categoryId")
    const currentCategory = categories.find((category) => category.id === currentCategoryId)
    const nextCategory = availableCategories[0]

    if ((!currentCategory || currentCategory.kind !== transactionType) && nextCategory) {
      form.setValue("categoryId", nextCategory.id)
    }
  }, [availableCategories, categories, form, transactionType])

  async function onSubmit(values: ManualTransactionFormValues) {
    await onAdd(values)
    form.reset()
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Add transaction
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
          <SheetDescription>
            Add a revenue or expense row directly to the ledger source of truth.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.date}>
                <FieldLabel htmlFor="date">Date</FieldLabel>
                <DatePicker
                  value={form.watch("date") ?? ""}
                  onChange={(value) => form.setValue("date", value)}
                />
                <FieldError errors={[form.formState.errors.date]} />
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select value={transactionType} onValueChange={(value) => form.setValue("type", value as "revenue" | "expense")}>
                  <SelectTrigger className="w-full" aria-label="Type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field data-invalid={!!form.formState.errors.description}>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input id="description" aria-invalid={!!form.formState.errors.description} {...form.register("description")} />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.amount}>
                <FieldLabel htmlFor="amount">Amount</FieldLabel>
                <Input id="amount" type="number" step="0.01" aria-invalid={!!form.formState.errors.amount} {...form.register("amount")} />
                <FieldError errors={[form.formState.errors.amount]} />
              </Field>
              <Field>
                <FieldLabel>Currency</FieldLabel>
                <Select value={form.watch("currency")} onValueChange={(value) => form.setValue("currency", value as "USD" | "AED")}>
                  <SelectTrigger className="w-full" aria-label="Currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel>Department</FieldLabel>
              <Select value={form.watch("departmentId")} onValueChange={(value) => form.setValue("departmentId", value ?? "") }>
                <SelectTrigger className="w-full" aria-label="Department">
                  <span className="line-clamp-1 flex-1 text-left">
                    {nameById(departments, form.watch("departmentId") || null)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select value={form.watch("categoryId")} onValueChange={(value) => form.setValue("categoryId", value ?? "") }>
                <SelectTrigger className="w-full" aria-label="Category">
                  <span className="line-clamp-1 flex-1 text-left">
                    {nameById(categories, form.watch("categoryId") || null)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Client or vendor</FieldLabel>
              {transactionType === "revenue" ? (
                <Select value={form.watch("clientId") || "none"} onValueChange={(value) => form.setValue("clientId", value === "none" ? "" : (value ?? ""))}>
                  <SelectTrigger className="w-full" aria-label="Client">
                    <span className="line-clamp-1 flex-1 text-left">
                      {form.watch("clientId") ? nameById(clients, form.watch("clientId") ?? null) : "No client"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">No client</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <Input {...form.register("vendor")} placeholder="Vendor" />
              )}
              <FieldDescription>Stored as client_id or vendor on one transaction model.</FieldDescription>
            </Field>
          </FieldGroup>
          <SheetFooter className="px-0">
            <Button type="submit" disabled={isAdding}>
              {isAdding ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
              Add transaction
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function LedgerWorkspace() {
  const [urlState, urlSetters] = useLedgerUrlState()
  const { filters, page, pageSize, search: urlSearch, sortBy, sortDir } = urlState
  const { setFilters, clearFilter, resetFilters, setPagination, setSorting, setSearch } = urlSetters
  const queryClient = useQueryClient()

  const apiFilters: LedgerApiFilters = {
    ...filters,
    page,
    pageSize,
    sortBy: sortBy ?? undefined,
    sortDir: sortDir ?? undefined,
  }

  const queryKey = transactionsQueryKey(apiFilters)
  const ledgerQuery = useQuery({
    queryFn: () => fetchLedgerData(apiFilters),
    queryKey,
  })
  const [bulkDepartmentId, setBulkDepartmentId] = React.useState<string>("")
  const [bulkCategoryId, setBulkCategoryId] = React.useState<string>("")
  const [searchInput, setSearchInput] = React.useState(urlSearch ?? "")

  React.useEffect(() => {
    setSearchInput(urlSearch ?? "")
  }, [urlSearch])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (urlSearch ?? "")) {
        setSearch(searchInput)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput, urlSearch, setSearch])

  const data = ledgerQuery.data
  const departments = data?.departments ?? []
  const categories = data?.categories ?? []
  const clients = data?.clients ?? []
  const pageRows = data?.rows ?? []
  const transactions = pageRows
  const revenue = data?.totals.revenueUsd ?? 0
  const expenses = data?.totals.expenseUsd ?? 0
  const totalRows = data?.pagination.totalRows ?? 0
  const totalPages = data?.pagination.totalPages ?? 0

  const createTransactionMutation = useMutation({
    mutationFn: createLedgerTransaction,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to add transaction")
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] })
      toast.success("Transaction added")
    },
  })

  const updateTransactionMutation = useMutation({
    mutationFn: updateLedgerTransaction,
    onError: (error, _input, context: { previous?: LedgerData } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast.error(error instanceof Error ? error.message : "Unable to update transaction")
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<LedgerData>(queryKey)

      queryClient.setQueryData<LedgerData>(queryKey, (current) =>
        current
          ? withRows(
              current,
              current.rows.map((transaction) =>
                transaction.id === id ? { ...transaction, ...patch } : transaction
              )
            )
          : current
      )

      return { previous }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
    onSuccess: ({ transaction }) => {
      queryClient.setQueryData<LedgerData>(queryKey, (current) =>
        current
          ? withRows(
              current,
              current.rows.map((row) => (row.id === transaction.id ? transaction : row))
            )
          : current
      )
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateLedgerTransactions,
    onError: (error, _input, context: { previous?: LedgerData } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast.error(error instanceof Error ? error.message : "Unable to bulk update transactions")
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<LedgerData>(queryKey)

      queryClient.setQueryData<LedgerData>(queryKey, (current) =>
        current
          ? withRows(
              current,
              current.rows.map((transaction) =>
                input.ids.includes(transaction.id)
                  ? {
                      ...transaction,
                      categoryId: input.categoryId,
                      departmentId: input.departmentId,
                      subcategoryId: input.subcategoryId ?? null,
                    }
                  : transaction
              )
            )
          : current
      )

      return { previous }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
    onSuccess: ({ transactions: updatedTransactions }) => {
      const updatedById = new Map(updatedTransactions.map((transaction) => [transaction.id, transaction]))
      queryClient.setQueryData<LedgerData>(queryKey, (current) =>
        current
          ? withRows(
              current,
              current.rows.map((row) => updatedById.get(row.id) ?? row)
            )
          : current
      )
      toast.success(`Bulk edited ${updatedTransactions.length} rows`)
    },
  })
  const clientVendorOptions = React.useMemo(() => {
    const vendors = Array.from(
      new Set(transactions.map((transaction) => transaction.vendor).filter(Boolean) as string[])
    ).sort()

    return [
      ...clients.map((client) => ({ value: client.id, label: client.name })),
      ...vendors.map((vendor) => ({ value: vendor, label: vendor })),
    ]
  }, [clients, transactions])

  React.useEffect(() => {
    if (!bulkDepartmentId && departments[0]) {
      setBulkDepartmentId(departments[0].id)
    }
  }, [bulkDepartmentId, departments])

  React.useEffect(() => {
    const rootCategories = categories.filter((category) => category.parentId === null)
    const defaultCategory = rootCategories.find((category) => category.kind === "expense") ?? rootCategories[0]
    if (!bulkCategoryId && defaultCategory) {
      setBulkCategoryId(defaultCategory.id)
    }
  }, [bulkCategoryId, categories])

  function updateTransaction(id: string, patch: Partial<Transaction>) {
    const previous = transactions.find((transaction) => transaction.id === id)
    if (!previous) return

    updateTransactionMutation.mutate({ id, patch })
    toast("Ledger row updated", {
      description: "Optimistic edit queued for the backend.",
      action: {
        label: "Undo edit",
        onClick: () => {
          updateTransactionMutation.mutate({ id, patch: previous })
        },
      },
    })
  }

  function applyBulkEdit(selectedTransactionIds: string[]) {
    if (selectedTransactionIds.length === 0 || !bulkDepartmentId || !bulkCategoryId) return

    bulkUpdateMutation.mutate({
      categoryId: bulkCategoryId,
      departmentId: bulkDepartmentId,
      ids: selectedTransactionIds,
    })
  }

  const controlledPagination: PaginationState = {
    pageIndex: page - 1,
    pageSize,
  }
  const controlledSorting: SortingState = sortBy
    ? [{ id: sortBy, desc: sortDir !== "asc" }]
    : []

  const columns = React.useMemo<ColumnDef<Transaction>[]>(() => [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <DatePicker
            value={transaction.date}
            onChange={(value) => {
              if (value && value !== transaction.date) {
                updateTransaction(transaction.id, { date: value })
              }
            }}
            className="h-7 min-w-36 border-transparent bg-transparent shadow-none hover:bg-input/30"
          />
        )
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Select
            value={transaction.type}
            onValueChange={(value) => {
              const type = value as Transaction["type"]
              const nextCategory = categories.find((category) => category.kind === type && category.parentId === null)
              updateTransaction(transaction.id, {
                type,
                categoryId: nextCategory?.id ?? transaction.categoryId,
                subcategoryId: null,
                clientId: type === "revenue" ? transaction.clientId : null,
                vendor: type === "expense" ? transaction.vendor : null,
              })
            }}
          >
            <SelectTrigger className="h-7 w-28" aria-label="Edit type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Input
            className="h-7 min-w-56 border-transparent bg-transparent shadow-none hover:bg-input/30"
            defaultValue={transaction.description}
            onBlur={(event) => {
              if (event.currentTarget.value !== transaction.description) {
                updateTransaction(transaction.id, { description: event.currentTarget.value })
              }
            }}
          />
        )
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Input
            className="h-7 min-w-28 border-transparent bg-transparent text-right shadow-none hover:bg-input/30"
            type="number"
            step="0.01"
            defaultValue={transaction.amount}
            onBlur={(event) => {
              const amount = Number(event.currentTarget.value)
              if (Number.isFinite(amount) && amount !== transaction.amount) {
                updateTransaction(transaction.id, { amount })
              }
            }}
          />
        )
      },
    },
    {
      accessorKey: "currency",
      enableSorting: false,
      header: "Currency",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Select
            value={transaction.currency}
            onValueChange={(value) => updateTransaction(transaction.id, {
              currency: value as Transaction["currency"],
              fxRateToUsd: value === "AED" ? 0.2723 : 1,
            })}
          >
            <SelectTrigger className="h-7 w-24" aria-label="Edit currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="AED">AED</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "department",
      accessorFn: (row) => nameById(departments, row.departmentId),
      header: "Department",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Select
            value={transaction.departmentId}
            onValueChange={(value) => updateTransaction(transaction.id, { departmentId: value ?? transaction.departmentId })}
          >
            <SelectTrigger className="h-7 w-48" aria-label="Edit department">
              <span className="line-clamp-1 flex-1 text-left">{nameById(departments, transaction.departmentId)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "category",
      accessorFn: (row) => nameById(categories, row.categoryId),
      header: "Category",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Select
            value={transaction.categoryId}
            onValueChange={(value) => updateTransaction(transaction.id, { categoryId: value ?? transaction.categoryId, subcategoryId: null })}
          >
            <SelectTrigger className="h-7 w-52" aria-label="Edit category">
              <span className="line-clamp-1 flex-1 text-left">{nameById(categories, transaction.categoryId)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {categories.filter((category) => category.kind === transaction.type && category.parentId === null).map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "subcategory",
      enableSorting: false,
      accessorFn: (row) => nameById(categories, row.subcategoryId),
      header: "Subcategory",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Select
            value={transaction.subcategoryId ?? "none"}
            onValueChange={(value) => updateTransaction(transaction.id, { subcategoryId: !value || value === "none" ? null : value })}
          >
            <SelectTrigger className="h-7 w-48" aria-label="Edit subcategory">
              <span className="line-clamp-1 flex-1 text-left">
                {transaction.subcategoryId ? nameById(categories, transaction.subcategoryId) : "None"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">None</SelectItem>
                {categories.filter((category) => category.parentId === transaction.categoryId).map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "client_vendor",
      enableSorting: false,
      accessorFn: (row) => row.clientId ? nameById(clients, row.clientId) : row.vendor ?? "",
      header: "Client/vendor",
      cell: ({ row }) => {
        const transaction = row.original
        return transaction.type === "revenue" ? (
          <Select
            value={transaction.clientId ?? "none"}
            onValueChange={(value) => updateTransaction(transaction.id, { clientId: value === "none" ? null : value, vendor: null })}
          >
            <SelectTrigger className="h-7 w-40" aria-label="Edit client">
              <span className="line-clamp-1 flex-1 text-left">
                {transaction.clientId ? nameById(clients, transaction.clientId) : "No client"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">No client</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="h-7 min-w-48 border-transparent bg-transparent shadow-none hover:bg-input/30"
            defaultValue={transaction.vendor ?? ""}
            onBlur={(event) => {
              if (event.currentTarget.value !== (transaction.vendor ?? "")) {
                updateTransaction(transaction.id, { vendor: event.currentTarget.value || null, clientId: null })
              }
            }}
          />
        )
      },
    },
    {
      accessorKey: "recurring",
      header: "Recurring",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Checkbox
            checked={transaction.recurring}
            onCheckedChange={(checked) => updateTransaction(transaction.id, { recurring: checked === true })}
            aria-label={`Mark ${transaction.description} recurring`}
          />
        )
      },
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Select
            value={transaction.source}
            onValueChange={(value) => updateTransaction(transaction.id, { source: value as Transaction["source"] })}
          >
            <SelectTrigger className="h-7 w-32" aria-label="Edit source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="automation">Automation</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      accessorKey: "attachmentUrl",
      enableSorting: false,
      header: "Attachment",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <Input
            className="h-7 min-w-44 border-transparent bg-transparent shadow-none hover:bg-input/30"
            defaultValue={transaction.attachmentUrl ?? ""}
            placeholder="Attachment URL"
            onBlur={(event) => {
              if (event.currentTarget.value !== (transaction.attachmentUrl ?? "")) {
                updateTransaction(transaction.id, { attachmentUrl: event.currentTarget.value || null })
              }
            }}
          />
        )
      },
    },
  ], [categories, clients, departments, transactions])

  function LedgerBulkActions(table: TanStackTable<Transaction>) {
    const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original)
    const selectedIds = selectedRows.map((row) => row.id)
    const selectedTypes = new Set(selectedRows.map((row) => row.type))
    const isMixedTypes = selectedTypes.size > 1
    const bulkCategoryKind = selectedTypes.size === 1 ? [...selectedTypes][0] : undefined
    const bulkCategoryOptions = categories.filter(
      (category) => category.parentId === null && (!bulkCategoryKind || category.kind === bulkCategoryKind)
    )

    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Bulk edit selected rows</span>
        <Select value={bulkDepartmentId} onValueChange={(value) => setBulkDepartmentId(value ?? bulkDepartmentId)}>
          <SelectTrigger aria-label="Bulk department" className="w-40">
            <span className="line-clamp-1 flex-1 text-left">
              {nameById(departments, bulkDepartmentId || null)}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={bulkCategoryId} onValueChange={(value) => setBulkCategoryId(value ?? bulkCategoryId)}>
          <SelectTrigger aria-label="Bulk category" className="w-48" disabled={isMixedTypes}>
            <span className="line-clamp-1 flex-1 text-left">
              {isMixedTypes ? "Mixed types" : nameById(categories, bulkCategoryId || null)}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {bulkCategoryOptions.map((category) => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          disabled={selectedIds.length === 0 || isMixedTypes}
          onClick={() => {
            applyBulkEdit(selectedIds)
            table.resetRowSelection()
          }}
        >
          Apply to {selectedIds.length} rows
        </Button>
        {isMixedTypes && (
          <span className="text-xs text-muted-foreground">Select rows of the same type to bulk edit</span>
        )}
      </div>
    )
  }

  if (ledgerQuery.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading ledger data...
      </div>
    )
  }

  if (ledgerQuery.isError) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        <div>{ledgerQuery.error instanceof Error ? ledgerQuery.error.message : "Unable to load ledger data."}</div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FiltersDialog
              title="Ledger filters"
              description="Filter transactions by date, type, department, category, client/vendor, source, or search terms."
              count={activeFilterCount(filters)}
            >
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field className="min-w-44">
                    <FieldLabel htmlFor="filter-from">From</FieldLabel>
                    <DatePicker
                      value={filters.from ?? ""}
                      onChange={(value) => setFilters({ from: value || undefined, ids: undefined })}
                    />
                  </Field>
                  <Field className="min-w-44">
                    <FieldLabel htmlFor="filter-to">To</FieldLabel>
                    <DatePicker
                      value={filters.to ?? ""}
                      onChange={(value) => setFilters({ to: value || undefined, ids: undefined })}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectFilter
                    label="Type"
                    value={filters.type}
                    onValueChange={(value) => setFilters({ type: value as TransactionFilters["type"], ids: undefined })}
                    options={[
                      { value: "revenue", label: "Revenue" },
                      { value: "expense", label: "Expense" },
                    ]}
                  />
                  <SelectFilter
                    label="Department"
                    value={filters.departmentId}
                    onValueChange={(value) => setFilters({ departmentId: value, ids: undefined })}
                    options={departments.map((department) => ({ value: department.id, label: department.name }))}
                  />
                  <SelectFilter
                    label="Category"
                    value={filters.categoryId}
                    onValueChange={(value) => setFilters({ categoryId: value, ids: undefined })}
                    options={categories.filter((category) => category.parentId === null).map((category) => ({ value: category.id, label: category.name }))}
                  />
                  <SelectFilter
                    label="Client/vendor"
                    value={filters.clientOrVendor}
                    onValueChange={(value) => setFilters({ clientOrVendor: value, ids: undefined })}
                    options={clientVendorOptions}
                  />
                  <SelectFilter
                    label="Source"
                    value={filters.source}
                    onValueChange={(value) => setFilters({ source: value as TransactionFilters["source"], ids: undefined })}
                    options={[
                      { value: "manual", label: "Manual" },
                      { value: "csv", label: "CSV" },
                      { value: "automation", label: "Automation" },
                    ]}
                  />
                </div>
                <Field className="min-w-56 flex-1">
                  <FieldLabel htmlFor="filter-search">Search</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="filter-search"
                      defaultValue={filters.search ?? ""}
                      placeholder="Description, client, vendor"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          setFilters({ search: event.currentTarget.value || undefined, ids: undefined })
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Apply search"
                      onClick={() => {
                        const input = document.getElementById("filter-search") as HTMLInputElement | null
                        setFilters({ search: input?.value || undefined, ids: undefined })
                      }}
                    >
                      <SearchIcon />
                    </Button>
                  </div>
                </Field>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <RotateCcwIcon data-icon="inline-start" />
                    Reset filters
                  </Button>
                </div>
              </div>
            </FiltersDialog>
            <ManualTransactionSheet
              departments={departments}
              categories={categories}
              clients={clients}
              isAdding={createTransactionMutation.isPending}
              onAdd={async (values) => {
                await createTransactionMutation.mutateAsync(values)
              }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {activeFilterCount(filters)} active filters
          </div>
        </div>
        <FilterChips
          filters={filters}
          departments={departments}
          categories={categories}
          clients={clients}
          onRemove={clearFilter}
          onReset={resetFilters}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Revenue</div>
          <div className="mt-1 text-xl font-semibold">{formatCurrency(revenue)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Expenses</div>
          <div className="mt-1 text-xl font-semibold">{formatCurrency(expenses)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Net</div>
          <div className="mt-1 text-xl font-semibold">{formatCurrency(revenue - expenses)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Filtered rows</div>
          <div className="mt-1 text-xl font-semibold">{totalRows}</div>
          <div className="mt-1 text-xs text-muted-foreground">{activeFilterCount(filters)} active filters</div>
        </div>
      </div>
      <DataTable
        data={pageRows}
        columns={columns}
        getRowId={(row) => row.id}
        enableRowSelection
        wide
        serverSide
        searchPlaceholder="Search ledger rows"
        bulkActions={LedgerBulkActions}
        pageSizeOptions={[5, 10, 20, 50]}
        pageCount={totalPages}
        totalRows={totalRows}
        controlledPagination={controlledPagination}
        controlledSorting={controlledSorting}
        controlledSearch={searchInput}
        onPaginationChange={setPagination}
        onSortingChange={setSorting}
        onSearchChange={setSearchInput}
      />
    </div>
  )
}
