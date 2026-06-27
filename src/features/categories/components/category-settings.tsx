"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef, Table as TanStackTable } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArchiveIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react"

import { ConfirmDialog, type ConfirmDialogState } from "@/components/common/confirm-dialog"
import { DataTable } from "@/components/common/data-table"
import { DatePicker } from "@/components/common/date-picker"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import { RenameDialog, type RenameDialogState } from "@/components/common/rename-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
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
import { categoryFormSchema } from "@/domain/schemas"
import type { Category, CategoryFormValues, RecurringItem } from "@/domain/types"

type RecurringTemplateDraft = {
  id: string
  template: string
  nextRun: string
  idempotencyKey: string
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
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Rename ${category.name}`}
                    onClick={() => onRenameCategory(category.id, category.name)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Archive ${category.name}`}
                    onClick={() => onArchiveCategory(category.id, category.name)}
                  >
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

export function CategorySettings({
  categories: initialCategories,
  recurringItems,
}: {
  categories: Category[]
  recurringItems: RecurringItem[]
}) {
  const [categories, setCategories] = React.useState(initialCategories)
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
  const [recurringTemplates, setRecurringTemplates] = React.useState(() =>
    recurringItems.map((item) => ({
      id: item.id,
      template: item.template,
      nextRun: item.nextRun,
      idempotencyKey: item.idempotencyKey,
    }))
  )
  const [ruleDraft, setRuleDraft] = React.useState("")
  const [mappingDraft, setMappingDraft] = React.useState("")
  const [templateDraft, setTemplateDraft] = React.useState("Subscription renewal, {month}")
  const [templateNextRun, setTemplateNextRun] = React.useState("2026-07-15")
  const [renameTarget, setRenameTarget] = React.useState<RenameTarget | null>(null)
  const [archiveTarget, setArchiveTarget] = React.useState<ArchiveTarget | null>(null)

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema as never) as never,
    defaultValues: { name: "", kind: "expense", parentId: "" },
  })
  const kind = form.watch("kind")
  const parentOptions = categories.filter(
    (category) => category.kind === kind && category.parentId === null && !category.archived
  )
  const rootRevenue = categories.filter((category) => category.kind === "revenue" && category.parentId === null && !category.archived)
  const rootExpense = categories.filter((category) => category.kind === "expense" && category.parentId === null && !category.archived)

  function onSubmit(values: CategoryFormValues) {
    const id = `cat_local_${Date.now()}`
    setCategories((current) => [
      ...current,
      {
        id,
        name: values.name,
        kind: values.kind,
        parentId: values.parentId || null,
        archived: false,
      },
    ])
    toast.success("Category added")
    form.reset({ name: "", kind: values.kind, parentId: "" })
  }

  function renameCategory(id: string, name: string) {
    setCategories((current) => current.map((category) => category.id === id ? { ...category, name } : category))
    toast.success("Category renamed")
  }

  function archiveCategory(id: string) {
    setCategories((current) => current.map((category) => category.id === id ? { ...category, archived: true } : category))
    toast("Category archived", { description: "Prototype state only. Historical rows still reference stable IDs." })
  }

  function handleRenameConfirm(value: string) {
    if (!renameTarget) return
    switch (renameTarget.kind) {
      case "category":
      case "subcategory":
        renameCategory(renameTarget.id!, value)
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
        setRecurringTemplates((current) => current.map((template) => template.id === renameTarget.id ? { ...template, template: value } : template))
        toast.success("Recurring template updated")
        break
    }
  }

  function handleArchiveConfirm() {
    if (!archiveTarget) return
    switch (archiveTarget.kind) {
      case "category":
      case "subcategory":
        archiveCategory(archiveTarget.id!)
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
        setRecurringTemplates((current) => current.filter((template) => template.id !== archiveTarget.id))
        toast("Recurring template archived")
        break
      case "bulk-templates":
        setRecurringTemplates((current) => current.filter((template) => !archiveTarget.ids!.includes(template.id)))
        toast(`Archived ${archiveTarget.ids!.length} recurring templates`)
        break
    }
  }

  const renameDialogState: RenameDialogState = renameTarget ? { open: true, initialValue: renameTarget.initialValue } : null
  const archiveDialogState: ConfirmDialogState = archiveTarget ? { open: true } : null

  const recurringColumns = React.useMemo<ColumnDef<RecurringTemplateDraft>[]>(() => [
    {
      accessorKey: "template",
      header: "Template",
    },
    {
      accessorKey: "nextRun",
      header: "Next run",
    },
    {
      accessorKey: "idempotencyKey",
      header: "Idempotency key",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.idempotencyKey}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Rename ${item.template}`}
              onClick={() => setRenameTarget({ kind: "template", id: item.id, initialValue: item.template })}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Archive ${item.template}`}
              onClick={() => setArchiveTarget({ kind: "template", id: item.id, label: item.template })}
            >
              <TrashIcon />
            </Button>
          </div>
        )
      },
    },
  ], [])

  function RecurringBulkActions(table: TanStackTable<RecurringTemplateDraft>) {
    const [confirmState, setConfirmState] = React.useState<ConfirmDialogState>(null)
    const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id)

    return (
      <>
        <ConfirmDialog
          state={confirmState}
          onOpenChange={setConfirmState}
          title="Archive recurring templates"
          description={`Archive ${selectedIds.length} selected recurring templates? This cannot be undone in the prototype.`}
          confirmLabel="Archive"
          destructive
          onConfirm={() => {
            setRecurringTemplates((current) => current.filter((template) => !selectedIds.includes(template.id)))
            table.resetRowSelection()
            toast(`Archived ${selectedIds.length} recurring templates`)
          }}
        />
        <Button
          variant="outline"
          disabled={selectedIds.length === 0}
          onClick={() => setConfirmState({ open: true })}
        >
          Archive {selectedIds.length} selected
        </Button>
      </>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Category settings"
        description="Manage revenue and expense categories, rules, recurring templates, and CSV mapping defaults as configurable data."
      />

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
        description={archiveTarget ? `Are you sure you want to archive ${archiveTarget.label}?` : ""}
        confirmLabel="Archive"
        destructive
        onConfirm={handleArchiveConfirm}
      />

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add category</CardTitle>
            <CardDescription>Use React Hook Form and Zod validation for future backend replacement.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Field data-invalid={!!form.formState.errors.name}>
                  <FieldLabel htmlFor="category-name">Name</FieldLabel>
                  <Input id="category-name" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
                  <FieldError errors={[form.formState.errors.name]} />
                </Field>
                <Field>
                  <FieldLabel>Kind</FieldLabel>
                  <Select value={kind} onValueChange={(value) => form.setValue("kind", value as "revenue" | "expense")}>
                    <SelectTrigger className="w-full" aria-label="Kind">
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
                <Field>
                  <FieldLabel>Parent category</FieldLabel>
                  <Select value={form.watch("parentId") || "root"} onValueChange={(value) => form.setValue("parentId", value === "root" ? "" : (value ?? ""))}>
                    <SelectTrigger className="w-full" aria-label="Parent category">
                      <SelectValue />
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
                <Button type="submit">
                  <PlusIcon data-icon="inline-start" />
                  Add category
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <div className="grid gap-4">
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
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Categorization rules</CardTitle>
            <CardDescription>Human-readable rules that run before AI suggestions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            <div className="flex gap-2">
              <Input
                value={ruleDraft}
                onChange={(event) => setRuleDraft(event.target.value)}
                placeholder="If vendor contains Vercel, set Software & subscriptions > infrastructure"
              />
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
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Rename categorization rule"
                    onClick={() => setRenameTarget({ kind: "rule", index, initialValue: rule })}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Archive categorization rule"
                    onClick={() => setArchiveTarget({ kind: "rule", index, label: "this categorization rule" })}
                  >
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
            <CardDescription>Idempotency keys prevent double posting.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2 md:grid-cols-[1fr_9rem_auto]">
              <Input value={templateDraft} onChange={(event) => setTemplateDraft(event.target.value)} />
              <DatePicker
                value={templateNextRun}
                onChange={(value) => setTemplateNextRun(value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!templateDraft.trim() || !templateNextRun) return
                  const id = `rec_local_${Date.now()}`
                  setRecurringTemplates((current) => [
                    ...current,
                    {
                      id,
                      template: templateDraft.trim(),
                      nextRun: templateNextRun,
                      idempotencyKey: `${id}-period`,
                    },
                  ])
                  toast.success("Recurring template added")
                }}
              >
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
            <DataTable
              data={recurringTemplates}
              columns={recurringColumns}
              getRowId={(row) => row.id}
              enableRowSelection
              bulkActions={RecurringBulkActions}
              searchPlaceholder="Search recurring templates"
              initialPageSize={5}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CSV mapping rules</CardTitle>
            <CardDescription>Saved mappings by file shape.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            <div className="flex gap-2">
              <Input
                value={mappingDraft}
                onChange={(event) => setMappingDraft(event.target.value)}
                placeholder="Amount Paid -> amount"
              />
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
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Rename CSV mapping rule"
                    onClick={() => setRenameTarget({ kind: "mapping", index, initialValue: rule })}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Archive CSV mapping rule"
                    onClick={() => setArchiveTarget({ kind: "mapping", index, label: "this CSV mapping rule" })}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
