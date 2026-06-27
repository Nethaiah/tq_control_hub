"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef, Table as TanStackTable } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { CheckIcon, FileWarningIcon, XIcon } from "lucide-react"

import { DataTable } from "@/components/common/data-table"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@/components/kibo-ui/dropzone"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { csvMappingFormSchema } from "@/domain/schemas"
import type { Category, CsvImport, CsvMappingFormValues, CsvStagedRow, Department, Transaction } from "@/domain/types"

function getName<T extends { id: string; name: string }>(items: T[], id: string | null) {
  if (!id) return "Unmapped"
  return items.find((item) => item.id === id)?.name ?? "Unmapped"
}

export function CsvImportReview({
  imports,
  rows,
  departments,
  categories,
}: {
  imports: CsvImport[]
  rows: CsvStagedRow[]
  departments: Department[]
  categories: Category[]
}) {
  const [stagedRows, setStagedRows] = React.useState(rows)
  const [importRecords, setImportRecords] = React.useState(imports)
  const [committedRows, setCommittedRows] = React.useState<Transaction[]>([])
  const [uploadedFiles, setUploadedFiles] = React.useState<File[] | undefined>(undefined)
  const form = useForm<CsvMappingFormValues>({
    resolver: zodResolver(csvMappingFormSchema as never) as never,
    defaultValues: {
      date: "Date",
      description: "Memo",
      amount: "Debit",
      currency: "Currency",
    },
  })
  const activeImport = importRecords.find((item) => item.id === "import_meta_june") ?? importRecords[0]
  const duplicateImport = importRecords.find((item) => item.status === "blocked_duplicate")
  const lowConfidenceCount = stagedRows.filter((row) => row.reviewState === "needs_human").length
  const blockedCount = stagedRows.filter((row) => row.reviewState === "blocked").length
  const approvedCount = stagedRows.filter((row) => row.reviewState === "approved").length
  const committableRows = stagedRows.filter(
    (row) =>
      row.reviewState === "approved" &&
      !row.duplicate &&
      row.validationIssues.length === 0 &&
      row.parsedDate &&
      row.parsedAmount &&
      row.currency &&
      row.suggestedDepartmentId &&
      row.suggestedCategoryId
  )

  function saveMapping(values: CsvMappingFormValues) {
    toast.success("Mapping saved for this file shape", {
      description: `${values.date}, ${values.description}, ${values.amount}, ${values.currency}`,
    })
  }

  function setReviewState(id: string, reviewState: CsvStagedRow["reviewState"]) {
    setStagedRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row

        if (reviewState !== "approved") {
          return { ...row, reviewState }
        }

        return {
          ...row,
          reviewState,
          validationIssues: [],
          parsedDate: row.parsedDate ?? "2026-06-26",
          parsedAmount: row.parsedAmount ?? 95,
          currency: row.currency ?? "USD",
          suggestedDepartmentId: row.suggestedDepartmentId ?? "dept_operations",
          suggestedCategoryId: row.suggestedCategoryId ?? "cat_exp_office",
          suggestedSubcategoryId: row.suggestedSubcategoryId ?? "sub_exp_equipment",
        }
      })
    )
  }

  function commitApprovedRows() {
    const rowsToCommit = committableRows.map((row) => ({
      id: `tx_import_${row.id}`,
      date: row.parsedDate ?? "2026-06-26",
      type: "expense" as const,
      description: row.rawDescription,
      amount: row.parsedAmount ?? 0,
      currency: row.currency ?? "USD",
      fxRateToUsd: row.currency === "AED" ? 0.2723 : 1,
      departmentId: row.suggestedDepartmentId ?? "dept_operations",
      categoryId: row.suggestedCategoryId ?? "cat_exp_office",
      subcategoryId: row.suggestedSubcategoryId,
      clientId: null,
      vendor: row.rawDescription,
      recurring: false,
      recurrenceId: null,
      source: "csv" as const,
      attachmentUrl: `/imports/${activeImport.filename}`,
      createdBy: "csv-import-review",
    }))

    setCommittedRows(rowsToCommit)
    setImportRecords((current) =>
      current.map((item) => item.id === activeImport.id ? { ...item, status: "committed" } : item)
    )
    toast.success(`${rowsToCommit.length} approved rows committed to prototype ledger`, {
      description: "Duplicate rows were excluded and the import audit state was updated.",
    })
  }

  function reverseImport() {
    setCommittedRows([])
    setImportRecords((current) =>
      current.map((item) => item.id === activeImport.id ? { ...item, status: "needs_review" } : item)
    )
    toast("Import reversed", { description: "Prototype ledger rows were removed from the import preview." })
  }

  const stagedColumns = React.useMemo<ColumnDef<CsvStagedRow>[]>(() => [
    {
      accessorKey: "rawDate",
      header: "Raw date",
    },
    {
      accessorKey: "rawDescription",
      header: "Description",
    },
    {
      accessorKey: "rawAmount",
      header: "Amount",
    },
    {
      id: "suggestion",
      accessorFn: (row) => `${getName(departments, row.suggestedDepartmentId)} / ${getName(categories, row.suggestedCategoryId)} / ${getName(categories, row.suggestedSubcategoryId)}`,
      header: "Suggestion",
      cell: ({ row }) => (
        <span className="min-w-64">
          {getName(departments, row.original.suggestedDepartmentId)} / {getName(categories, row.original.suggestedCategoryId)} / {getName(categories, row.original.suggestedSubcategoryId)}
        </span>
      ),
    },
    {
      accessorKey: "confidence",
      header: "Confidence",
      meta: { align: "center" },
      cell: ({ row }) => (
        <Badge variant={row.original.confidence < 0.7 ? "destructive" : "outline"}>
          {Math.round(row.original.confidence * 100)}%
        </Badge>
      ),
    },
    {
      id: "validation",
      accessorFn: (row) => row.validationIssues.join(", ") || "Valid",
      header: "Validation",
      cell: ({ row }) => <span className="min-w-56">{row.original.validationIssues.length ? row.original.validationIssues.join(", ") : "Valid"}</span>,
    },
    {
      accessorKey: "reviewState",
      header: "Review state",
      meta: { align: "center" },
      cell: ({ row }) => <Badge variant="secondary">{row.original.reviewState}</Badge>,
    },
    {
      id: "review",
      header: "Review",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setReviewState(row.original.id, "approved")}>
            <CheckIcon data-icon="inline-start" />
            {row.original.reviewState === "blocked" ? "Correct" : "Apply"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setReviewState(row.original.id, "blocked")}>
            <XIcon data-icon="inline-start" />
            Block
          </Button>
        </div>
      ),
    },
  ], [categories, departments])

  const committedColumns = React.useMemo<ColumnDef<Transaction>[]>(() => [
    {
      accessorKey: "id",
      header: "Ledger id",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
    },
    {
      accessorKey: "date",
      header: "Date",
    },
    {
      accessorKey: "description",
      header: "Description",
    },
    {
      id: "department",
      accessorFn: (row) => getName(departments, row.departmentId),
      header: "Department",
    },
    {
      id: "category",
      accessorFn: (row) => getName(categories, row.categoryId),
      header: "Category",
    },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{row.original.amount} {row.original.currency}</div>,
    },
  ], [categories, departments])

  function StagedBulkActions(table: TanStackTable<CsvStagedRow>) {
    const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id)

    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={selectedIds.length === 0}
          onClick={() => {
            selectedIds.forEach((id) => setReviewState(id, "approved"))
            table.resetRowSelection()
          }}
        >
          Approve {selectedIds.length}
        </Button>
        <Button
          variant="ghost"
          disabled={selectedIds.length === 0}
          onClick={() => {
            selectedIds.forEach((id) => setReviewState(id, "blocked"))
            table.resetRowSelection()
          }}
        >
          Block {selectedIds.length}
        </Button>
      </div>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="CSV import review"
        description="Messy CSV rows are detected, mapped, validated, suggested, and staged before anything commits to the ledger."
      />
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload zone</CardTitle>
            <CardDescription>Drop a real bank or ad-platform CSV. Prototype uses mock parsing for the preview.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Dropzone
              accept={{ "text/csv": [".csv"] }}
              maxFiles={1}
              maxSize={5 * 1024 * 1024}
              src={uploadedFiles}
              onDrop={(acceptedFiles) => {
                setUploadedFiles(acceptedFiles)
                toast.success(`Uploaded ${acceptedFiles[0]?.name ?? "file"}`, {
                  description: "Mock parsing applied for the prototype preview.",
                })
              }}
              onError={(error) => toast.error(error.message)}
            >
              <DropzoneContent />
              <DropzoneEmptyState />
            </Dropzone>
            <div className="grid gap-2 rounded-lg border p-3 text-xs">
              <div className="flex justify-between gap-3"><span>Delimiter</span><span>{activeImport.delimiter}</span></div>
              <div className="flex justify-between gap-3"><span>Encoding</span><span>{activeImport.encoding}</span></div>
              <div className="flex justify-between gap-3"><span>Header row</span><span>{activeImport.headerRow}</span></div>
              <div className="flex justify-between gap-3"><span>Rows</span><span>{activeImport.rowCount}</span></div>
            </div>
            {duplicateImport ? (
              <Alert variant="destructive">
                <FileWarningIcon />
                <AlertTitle>Duplicate upload blocked</AlertTitle>
                <AlertDescription>
                  {duplicateImport.filename} matches {duplicateImport.duplicateOfImportId}. It will not double the books.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Column mapping</CardTitle>
            <CardDescription>Mapping is form state now and becomes saved backend config later.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(saveMapping)}>
              <FieldGroup>
                <div className="grid gap-3 md:grid-cols-2">
                  {(["date", "description", "amount", "currency"] as const).map((field) => (
                    <Field key={field} data-invalid={!!form.formState.errors[field]}>
                      <FieldLabel htmlFor={`mapping-${field}`}>{field}</FieldLabel>
                      <Input id={`mapping-${field}`} aria-invalid={!!form.formState.errors[field]} {...form.register(field)} />
                      <FieldError errors={[form.formState.errors[field]]} />
                    </Field>
                  ))}
                </div>
                <Button type="submit">Save mapping</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader><CardDescription>Approved rows</CardDescription><CardTitle>{approvedCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Low confidence</CardDescription><CardTitle>{lowConfidenceCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Blocked rows</CardDescription><CardTitle>{blockedCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Ready to commit</CardDescription><CardTitle>{committableRows.length}</CardTitle></CardHeader></Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Staging review</CardTitle>
          <CardDescription>AI suggestions are drafts. Low-confidence rows require human confirmation.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={stagedRows}
            columns={stagedColumns}
            getRowId={(row) => row.id}
            enableRowSelection
            bulkActions={StagedBulkActions}
            searchPlaceholder="Search staged rows"
            initialPageSize={5}
          />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button
          disabled={blockedCount > 0 || lowConfidenceCount > 0 || committableRows.length === 0}
          onClick={commitApprovedRows}
        >
          Commit approved rows
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Import audit and reversibility</CardTitle>
          <CardDescription>
            Committed rows are visible here as prototype ledger rows. The same import can be reversed from its audit record.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-xs">
            <span>Audit status: {activeImport.status}</span>
            <span>Duplicate file status: {duplicateImport?.status ?? "none"}</span>
            <Button variant="outline" size="sm" disabled={committedRows.length === 0} onClick={reverseImport}>
              Reverse import
            </Button>
          </div>
          {committedRows.length > 0 ? (
            <DataTable
              data={committedRows}
              columns={committedColumns}
              getRowId={(row) => row.id}
              enableRowSelection
              searchPlaceholder="Search committed rows"
              initialPageSize={5}
            />
          ) : (
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              No rows committed yet. Approve low-confidence rows, correct blocked rows, then commit approved non-duplicate rows.
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
