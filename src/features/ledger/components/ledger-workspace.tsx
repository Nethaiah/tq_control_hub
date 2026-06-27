"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef, Table as TanStackTable } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { PlusIcon, RotateCcwIcon, SearchIcon, XIcon } from "lucide-react"

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
import { amountToUsd, formatCurrency } from "@/domain/currency"
import { activeFilterCount, filterTransactions } from "@/domain/filters"
import { manualTransactionFormSchema } from "@/domain/schemas"
import type {
  Category,
  Client,
  Department,
  ManualTransactionFormValues,
  Transaction,
  TransactionFilters,
} from "@/domain/types"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { titleCase } from "@/lib/format"

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
}: {
  departments: Department[]
  categories: Category[]
  clients: Client[]
  onAdd: (transaction: Transaction) => void
}) {
  const form = useForm<ManualTransactionFormValues>({
    resolver: zodResolver(manualTransactionFormSchema as never) as never,
    defaultValues: {
      date: "2026-06-26",
      type: "expense",
      description: "",
      amount: 0,
      currency: "USD",
      departmentId: "dept_operations",
      categoryId: "cat_exp_software",
      subcategoryId: "",
      clientId: "",
      vendor: "",
    },
  })
  const transactionType = form.watch("type")
  const availableCategories = categories.filter(
    (category) => category.kind === transactionType && category.parentId === null && !category.archived
  )

  function onSubmit(values: ManualTransactionFormValues) {
    const transaction: Transaction = {
      id: `tx_manual_${Date.now()}`,
      date: values.date,
      type: values.type,
      description: values.description,
      amount: values.amount,
      currency: values.currency,
      fxRateToUsd: values.currency === "AED" ? 0.2723 : 1,
      departmentId: values.departmentId,
      categoryId: values.categoryId,
      subcategoryId: values.subcategoryId || null,
      clientId: values.clientId || null,
      vendor: values.vendor || null,
      recurring: false,
      recurrenceId: null,
      source: "manual",
      attachmentUrl: null,
      createdBy: "owner",
    }

    onAdd(transaction)
    form.reset()
    toast.success("Transaction added to prototype ledger")
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
            Frontend-only entry. The backend will replace this with a server action.
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
                  <SelectValue />
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
                  <SelectValue />
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
                    <SelectValue />
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
            <Button type="submit">Add transaction</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function LedgerWorkspace({
  rows,
  departments,
  categories,
  clients,
}: {
  rows: Transaction[]
  departments: Department[]
  categories: Category[]
  clients: Client[]
}) {
  const { filters, setFilters, clearFilter, resetFilters } = useUrlFilters()
  const [transactions, setTransactions] = React.useState(rows)
  const [bulkDepartmentId, setBulkDepartmentId] = React.useState<string>("dept_development")
  const [bulkCategoryId, setBulkCategoryId] = React.useState<string>("cat_exp_software")
  const filteredRows = React.useMemo(
    () => filterTransactions(transactions, filters, clients),
    [transactions, filters, clients]
  )
  const revenue = filteredRows
    .filter((transaction) => transaction.type === "revenue")
    .reduce((total, transaction) => total + amountToUsd(transaction), 0)
  const expenses = filteredRows
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + amountToUsd(transaction), 0)
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
    setTransactions(rows)
  }, [rows])

  function updateTransaction(id: string, patch: Partial<Transaction>) {
    const previous = transactions.find((transaction) => transaction.id === id)
    if (!previous) return

    setTransactions((current) =>
      current.map((transaction) => (transaction.id === id ? { ...transaction, ...patch } : transaction))
    )
    toast("Ledger row updated", {
      description: "Optimistic edit saved in the prototype.",
      action: {
        label: "Undo edit",
        onClick: () => {
          setTransactions((current) =>
            current.map((transaction) => (transaction.id === id ? previous : transaction))
          )
        },
      },
    })
  }

  function applyBulkEdit(selectedTransactionIds: string[]) {
    if (selectedTransactionIds.length === 0) return
    const previous = transactions
    setTransactions((current) =>
      current.map((transaction) =>
        selectedTransactionIds.includes(transaction.id)
          ? { ...transaction, departmentId: bulkDepartmentId, categoryId: bulkCategoryId }
          : transaction
      )
    )
    toast.success(`Bulk edited ${selectedTransactionIds.length} rows`, {
      action: {
        label: "Undo edit",
        onClick: () => setTransactions(previous),
      },
    })
  }

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
              <SelectValue />
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
              <SelectValue />
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
              <SelectValue />
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
              <SelectValue />
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
    const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id)

    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Bulk edit selected rows</span>
        <Select value={bulkDepartmentId} onValueChange={(value) => setBulkDepartmentId(value ?? bulkDepartmentId)}>
          <SelectTrigger aria-label="Bulk department" className="w-40">
            <SelectValue />
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
          <SelectTrigger aria-label="Bulk category" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {categories.filter((category) => category.parentId === null).map((category) => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          disabled={selectedIds.length === 0}
          onClick={() => {
            applyBulkEdit(selectedIds)
            table.resetRowSelection()
          }}
        >
          Apply to {selectedIds.length} rows
        </Button>
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
              onAdd={(transaction) => setTransactions((current) => [transaction, ...current])}
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
          <div className="mt-1 text-xl font-semibold">{filteredRows.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">{activeFilterCount(filters)} active filters</div>
        </div>
      </div>
      <DataTable
        data={filteredRows}
        columns={columns}
        getRowId={(row) => row.id}
        enableRowSelection
        wide
        searchPlaceholder="Search visible ledger rows"
        bulkActions={LedgerBulkActions}
        initialPageSize={10}
      />
    </div>
  )
}
