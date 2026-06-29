"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef, PaginationState, SortingState, Table as TanStackTable } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { CheckIcon, FileWarningIcon, Loader2Icon, XIcon } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { csvMappingFormSchema } from "@/domain/schemas"
import type { Category, CsvImport, CsvMappingFormValues, CsvStagedRow, Department, Transaction } from "@/domain/types"
import {
  useCommitImport,
  useImportsData,
  useReverseImport,
  useStagedRows,
  useUpdateStagedRow,
  useUploadCsv,
} from "../hooks/use-imports-queries"
import { useImportsUrlState } from "../hooks/use-imports-url-state"

function getName<T extends { id: string; name: string }>(items: T[], id: string | null) {
  if (!id) return "Unmapped"
  return items.find((item) => item.id === id)?.name ?? "Unmapped"
}

function isReadyForApproval(row: CsvStagedRow) {
  return (
    Boolean(row.parsedDate) &&
    Boolean(row.parsedAmount) &&
    Boolean(row.currency) &&
    Boolean(row.suggestedDepartmentId) &&
    Boolean(row.suggestedCategoryId)
  )
}

function makeApprovedPatch(row: CsvStagedRow): Partial<CsvStagedRow> {
  return { duplicate: false, reviewState: "approved", validationIssues: [] }
}

function TruncatedCell({
  children,
  className,
  tooltipAt = 36,
  value,
}: {
  children?: React.ReactNode
  className?: string
  tooltipAt?: number
  value: string
}) {
  if (value.length <= tooltipAt) {
    return <span className={className}>{children ?? value}</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span className={className} />}>
        {children ?? value}
      </TooltipTrigger>
      <TooltipContent className="max-w-96 whitespace-normal text-left">
        {value}
      </TooltipContent>
    </Tooltip>
  )
}

function suggestionText(row: CsvStagedRow, departments: Department[], categories: Category[]) {
  return `${getName(departments, row.suggestedDepartmentId)} / ${getName(categories, row.suggestedCategoryId)} / ${getName(categories, row.suggestedSubcategoryId)}`
}

function effectiveDate(row: CsvStagedRow) {
  return row.parsedDate ?? row.rawDate
}

function effectiveAmount(row: CsvStagedRow) {
  return row.parsedAmount === null ? row.rawAmount : String(row.parsedAmount)
}

function SuggestionSourceBadge({ row }: { row: CsvStagedRow }) {
  const label = row.suggestionSource === "openrouter" ? "OpenRouter" : row.suggestionSource === "manual" ? "Manual" : "Keyword"
  const variant = row.suggestionSource === "openrouter" ? "outline" : row.suggestionSource === "manual" ? "secondary" : "secondary"
  const model = row.suggestionModel ? ` · ${row.suggestionModel}` : ""

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}> 
        <Badge variant={variant}>{label}</Badge>
      </TooltipTrigger>
      <TooltipContent>{label}{model}</TooltipContent>
    </Tooltip>
  )
}

function ImportStatusBadge({ status }: { status: CsvImport["status"] }) {
  const variant = status === "blocked_duplicate" ? "destructive" : status === "committed" ? "outline" : "secondary"
  return <Badge variant={variant}>{status}</Badge>
}

export function CsvImportReview() {
  const [
    { importId, stagedPage, stagedPageSize, stagedReviewState, stagedSearch, stagedSortBy, stagedSortDir },
    { setImportId, setStagedPagination, setStagedReviewState, setStagedSearch, setStagedSorting },
  ] = useImportsUrlState()
  const importsQuery = useImportsData()
  const imports = importsQuery.data?.imports ?? []
  const departments = importsQuery.data?.departments ?? []
  const categories = importsQuery.data?.categories ?? []
  const activeImport = (importId ? imports.find((item) => item.id === importId) : null) ?? imports[0] ?? null
  const isActiveImportCommitted = activeImport?.status === "committed"
  const isActiveImportReviewable = activeImport?.status === "needs_review" || activeImport?.status === "staged"
  const [stagedReviewDraft, setStagedReviewDraft] = React.useState<CsvStagedRow["reviewState"] | null>(stagedReviewState)
  const stagedRowsQuery = useStagedRows(activeImport?.id, {
    page: stagedPage,
    pageSize: stagedPageSize,
    reviewState: stagedReviewState ?? undefined,
    search: stagedSearch ?? undefined,
    sortBy: stagedSortBy ?? undefined,
    sortDir: stagedSortDir ?? undefined,
  })
  const stagedRowsData = stagedRowsQuery.data
  const stagedRows = stagedRowsData?.stagedRows ?? []
  const uploadCsv = useUploadCsv()
  const updateRow = useUpdateStagedRow()
  const commitImport = useCommitImport()
  const reverseImport = useReverseImport()
  const [committedRows, setCommittedRows] = React.useState<Transaction[]>([])
  const [uploadedFiles, setUploadedFiles] = React.useState<File[] | undefined>(undefined)
  const form = useForm<CsvMappingFormValues>({
    resolver: zodResolver(csvMappingFormSchema as never) as never,
    defaultValues: {
      amount: "Amount",
      currency: "Currency",
      date: "Date",
      description: "Description",
    },
  })

  const duplicateImport = imports.find((item) => item.status === "blocked_duplicate")
  const expenseCategories = React.useMemo(
    () => categories.filter((category) => category.kind === "expense" && !category.archived),
    [categories]
  )
  const lowConfidenceCount = stagedRowsData?.summary.lowConfidenceCount ?? 0
  const blockedCount = stagedRowsData?.summary.blockedCount ?? 0
  const approvedCount = stagedRowsData?.summary.approvedCount ?? 0
  const committableCount = stagedRowsData?.summary.committableCount ?? 0
  const controlledSorting = React.useMemo<SortingState>(
    () => stagedSortBy ? [{ desc: stagedSortDir === "desc", id: stagedSortBy }] : [],
    [stagedSortBy, stagedSortDir]
  )
  const controlledPagination = React.useMemo<PaginationState>(
    () => ({ pageIndex: stagedPage - 1, pageSize: stagedPageSize }),
    [stagedPage, stagedPageSize]
  )
  const pageCount = stagedRowsData?.pagination.totalPages ?? 1
  const totalRows = stagedRowsData?.pagination.totalRows ?? 0

  React.useEffect(() => {
    setStagedReviewDraft(stagedReviewState)
  }, [stagedReviewState])

  function saveMapping(values: CsvMappingFormValues) {
    toast.success("Mapping ready for the next upload", {
      description: `${values.date}, ${values.description}, ${values.amount}, ${values.currency}`,
    })
  }

  function uploadFile(file: File) {
    uploadCsv.mutate(
      { file, mapping: form.getValues() },
      {
        onError: (error) => toast.error(error.message),
        onSuccess: (data) => {
          setImportId(data.import.id)
          setCommittedRows([])
          toast.success(`Uploaded ${data.import.filename}`, {
            description: data.import.status === "blocked_duplicate"
              ? "Duplicate file blocked before staging."
              : `${data.stagedRows.length} rows staged for human review.`,
          })
        },
      }
    )
  }

  function setReviewState(row: CsvStagedRow, reviewState: CsvStagedRow["reviewState"]) {
    if (!activeImport) return
    if (!isActiveImportReviewable || row.reviewState === "approved") return

    if (reviewState === "approved" && !isReadyForApproval(row)) {
      toast.error("Row still needs correction before approval", {
        description: row.validationIssues.join(", ") || "Missing parsed date, amount, currency, department, or category.",
      })
      return
    }

    const patch = reviewState === "approved" ? makeApprovedPatch(row) : { reviewState }
    updateRow.mutate(
      { importId: activeImport.id, patch, rowId: row.id },
      {
        onError: (error) => toast.error(error.message),
        onSuccess: (data) => toast.success(`Row marked ${data.stagedRow.reviewState}`),
      }
    )
  }

  function updateCorrection(row: CsvStagedRow, patch: Partial<CsvStagedRow>) {
    if (!activeImport) return

    updateRow.mutate(
      { importId: activeImport.id, patch, rowId: row.id },
      { onError: (error) => toast.error(error.message) }
    )
  }

  function StagedSelectValue({ children }: { children: React.ReactNode }) {
    return <span data-slot="select-value" className="flex flex-1 truncate text-left">{children}</span>
  }

  function correctionDisabled(row: CsvStagedRow) {
    return !activeImport || !isActiveImportReviewable || row.reviewState === "approved" || updateRow.isPending
  }

  function ParsedDateInput({ row }: { row: CsvStagedRow }) {
    const disabled = correctionDisabled(row)

    return (
      <Input
        key={`${row.id}-date-${row.parsedDate ?? ""}`}
        aria-label="Correct parsed date"
        className="h-8 w-36 font-mono text-xs"
        defaultValue={row.parsedDate ?? ""}
        disabled={disabled}
        type="date"
        onBlur={(event) => {
          const value = event.currentTarget.value || null
          if (value !== row.parsedDate) updateCorrection(row, { parsedDate: value })
        }}
      />
    )
  }

  function ParsedAmountInput({ row }: { row: CsvStagedRow }) {
    const disabled = correctionDisabled(row)

    return (
      <Input
        key={`${row.id}-amount-${row.parsedAmount ?? ""}`}
        aria-label="Correct parsed amount"
        className="h-8 w-28 font-mono text-xs"
        defaultValue={row.parsedAmount ?? ""}
        disabled={disabled}
        min="0"
        step="0.01"
        type="number"
        onBlur={(event) => {
          const value = event.currentTarget.value ? Number(event.currentTarget.value) : null
          if (value !== row.parsedAmount) updateCorrection(row, { parsedAmount: value })
        }}
      />
    )
  }

  function CurrencySelect({ row }: { row: CsvStagedRow }) {
    const disabled = correctionDisabled(row)

    return (
        <Select
          value={row.currency ?? "__none"}
          disabled={disabled}
          onValueChange={(value) => updateCorrection(row, { currency: value === "__none" ? null : value as CsvStagedRow["currency"] })}
        >
          <SelectTrigger className="h-8 w-24" aria-label="Correct currency">
            <StagedSelectValue>{row.currency ?? "Unset"}</StagedSelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__none">Unset</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="AED">AED</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
    )
  }

  function DepartmentSelect({ row }: { row: CsvStagedRow }) {
    const disabled = correctionDisabled(row)

    return (
        <Select
          value={row.suggestedDepartmentId ?? "__none"}
          disabled={disabled}
          onValueChange={(value) => updateCorrection(row, { suggestedDepartmentId: value === "__none" ? null : value })}
        >
          <SelectTrigger className="h-8 w-44" aria-label="Correct department">
            <StagedSelectValue>{getName(departments, row.suggestedDepartmentId)}</StagedSelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__none">Unmapped</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
    )
  }

  function CategorySelect({ row }: { row: CsvStagedRow }) {
    const disabled = correctionDisabled(row)

    return (
        <Select
          value={row.suggestedCategoryId ?? "__none"}
          disabled={disabled}
          onValueChange={(value) => updateCorrection(row, { suggestedCategoryId: value === "__none" ? null : value })}
        >
          <SelectTrigger className="h-8 w-52" aria-label="Correct category">
            <StagedSelectValue>{getName(expenseCategories, row.suggestedCategoryId)}</StagedSelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__none">Unmapped</SelectItem>
              {expenseCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
    )
  }

  function commitApprovedRows() {
    if (!activeImport) return

    commitImport.mutate(activeImport.id, {
      onError: (error) => toast.error(error.message),
      onSuccess: (data) => {
        setCommittedRows(data.transactions)
        toast.success(`${data.transactions.length} approved rows committed to the ledger`, {
          description: "Ledger and dashboard query caches were invalidated.",
        })
      },
    })
  }

  function reverseCommittedImport() {
    if (!activeImport) return

    reverseImport.mutate(activeImport.id, {
      onError: (error) => toast.error(error.message),
      onSuccess: (data) => {
        setCommittedRows([])
        toast.success("Import reversed", {
          description: `${data.transactions.length} ledger rows were marked reversed.`,
        })
      },
    })
  }

  const stagedColumns = React.useMemo<ColumnDef<CsvStagedRow>[]>(() => [
    {
      accessorKey: "rawDate",
      header: "Date",
      size: 120,
      meta: { className: "w-[120px] max-w-[120px] whitespace-nowrap", headerClassName: "w-[120px]" },
      cell: ({ row }) => {
        const value = effectiveDate(row.original)
        const tooltip = row.original.parsedDate && row.original.parsedDate !== row.original.rawDate
          ? `${row.original.parsedDate} (raw: ${row.original.rawDate})`
          : value

        return <TruncatedCell className="block truncate font-mono text-xs" tooltipAt={14} value={tooltip}>{value}</TruncatedCell>
      },
    },
    {
      accessorKey: "rawDescription",
      header: "Description",
      size: 340,
      meta: { className: "w-[340px] max-w-[340px]", headerClassName: "w-[340px]" },
      cell: ({ row }) => <TruncatedCell className="block truncate font-medium" value={row.original.rawDescription} />,
    },
    {
      accessorKey: "rawAmount",
      header: "Amount",
      size: 120,
      meta: { align: "right", className: "w-[120px] max-w-[120px] whitespace-nowrap", headerClassName: "w-[120px]" },
      cell: ({ row }) => {
        const value = effectiveAmount(row.original)
        const tooltip = row.original.parsedAmount !== null && value !== row.original.rawAmount
          ? `${value} (raw: ${row.original.rawAmount})`
          : value

        return <TruncatedCell className="block truncate text-right font-mono" tooltipAt={12} value={tooltip}>{value}</TruncatedCell>
      },
    },
    {
      id: "parsedDate",
      accessorFn: (row) => row.parsedDate ?? "",
      header: "Parsed date",
      enableSorting: false,
      size: 160,
      meta: { className: "w-[160px] max-w-[160px]", headerClassName: "w-[160px]" },
      cell: ({ row }) => <ParsedDateInput row={row.original} />,
    },
    {
      id: "parsedAmount",
      accessorFn: (row) => row.parsedAmount ?? 0,
      header: "Parsed amount",
      enableSorting: false,
      size: 130,
      meta: { className: "w-[130px] max-w-[130px]", headerClassName: "w-[130px]" },
      cell: ({ row }) => <ParsedAmountInput row={row.original} />,
    },
    {
      id: "currency",
      accessorFn: (row) => row.currency ?? "",
      header: "Currency",
      enableSorting: false,
      size: 110,
      meta: { className: "w-[110px] max-w-[110px]", headerClassName: "w-[110px]" },
      cell: ({ row }) => <CurrencySelect row={row.original} />,
    },
    {
      id: "departmentCorrection",
      accessorFn: (row) => getName(departments, row.suggestedDepartmentId),
      header: "Department",
      enableSorting: false,
      size: 190,
      meta: { className: "w-[190px] max-w-[190px]", headerClassName: "w-[190px]" },
      cell: ({ row }) => <DepartmentSelect row={row.original} />,
    },
    {
      id: "categoryCorrection",
      accessorFn: (row) => getName(expenseCategories, row.suggestedCategoryId),
      header: "Category",
      enableSorting: false,
      size: 220,
      meta: { className: "w-[220px] max-w-[220px]", headerClassName: "w-[220px]" },
      cell: ({ row }) => <CategorySelect row={row.original} />,
    },
    {
      id: "suggestion",
      accessorFn: (row) => suggestionText(row, departments, categories),
      header: "Suggestion",
      size: 360,
      meta: { className: "w-[360px] max-w-[360px]", headerClassName: "w-[360px]" },
      cell: ({ row }) => (
        <TruncatedCell className="block truncate" value={suggestionText(row.original, departments, categories)} />
      ),
    },
    {
      accessorKey: "confidence",
      header: "Confidence",
      size: 110,
      meta: { align: "center", className: "w-[110px] max-w-[110px]", headerClassName: "w-[110px]" },
      cell: ({ row }) => (
        <Badge variant={row.original.confidence < 0.7 ? "destructive" : "outline"}>
          {Math.round(row.original.confidence * 100)}%
        </Badge>
      ),
    },
    {
      accessorKey: "suggestionSource",
      header: "Source",
      size: 120,
      meta: { align: "center", className: "w-[120px] max-w-[120px]", headerClassName: "w-[120px]" },
      cell: ({ row }) => <SuggestionSourceBadge row={row.original} />,
    },
    {
      id: "validation",
      accessorFn: (row) => row.validationIssues.join(", ") || "Valid",
      header: "Validation",
      size: 240,
      meta: { className: "w-[240px] max-w-[240px]", headerClassName: "w-[240px]" },
      cell: ({ row }) => {
        const value = row.original.validationIssues.length ? row.original.validationIssues.join(", ") : "Valid"
        return <TruncatedCell className="block truncate" value={value} />
      },
    },
    {
      accessorKey: "reviewState",
      header: "Review state",
      size: 130,
      meta: { align: "center", className: "w-[130px] max-w-[130px]", headerClassName: "w-[130px]" },
      cell: ({ row }) => <Badge variant="secondary">{row.original.reviewState}</Badge>,
    },
    {
      id: "review",
      header: "Review",
      enableSorting: false,
      size: 170,
      meta: { className: "w-[170px] max-w-[170px]", headerClassName: "w-[170px]" },
      cell: ({ row }) => {
        if (isActiveImportCommitted) {
          return <Badge variant="outline">Committed</Badge>
        }

        if (row.original.reviewState === "approved") {
          return <Badge variant="outline">Approved</Badge>
        }

        return (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!isActiveImportReviewable || updateRow.isPending}
              onClick={() => setReviewState(row.original, "approved")}
            >
              <CheckIcon data-icon="inline-start" />
              {row.original.reviewState === "blocked" ? "Approve correction" : "Approve"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!isActiveImportReviewable || updateRow.isPending}
              onClick={() => setReviewState(row.original, "blocked")}
            >
              <XIcon data-icon="inline-start" />
              Block
            </Button>
          </div>
        )
      },
    },
  ], [categories, departments, expenseCategories, isActiveImportCommitted, isActiveImportReviewable, updateRow.isPending])

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
    const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original)
    const reviewableSelectedRows = selectedRows.filter((row) => row.reviewState !== "approved")

    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={reviewableSelectedRows.length === 0 || !isActiveImportReviewable || updateRow.isPending}
          onClick={() => {
            reviewableSelectedRows.forEach((row) => setReviewState(row, "approved"))
            table.resetRowSelection()
          }}
        >
          Approve {reviewableSelectedRows.length}
        </Button>
        <Button
          variant="ghost"
          disabled={reviewableSelectedRows.length === 0 || !isActiveImportReviewable || updateRow.isPending}
          onClick={() => {
            reviewableSelectedRows.forEach((row) => setReviewState(row, "blocked"))
            table.resetRowSelection()
          }}
        >
          Block {reviewableSelectedRows.length}
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <PageShell>
      <PageHeader
        title="CSV import review"
        description="Messy CSV rows are detected, mapped, validated, suggested, and staged before anything commits to the ledger."
      />
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload zone</CardTitle>
            <CardDescription>Drop a bank, ad-platform, or expense CSV. The backend parses and stages it for review.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Dropzone
              accept={{ "text/csv": [".csv"] }}
              maxFiles={1}
              maxSize={5 * 1024 * 1024}
              src={uploadedFiles}
              onDrop={(acceptedFiles) => {
                const file = acceptedFiles[0]
                if (!file) return
                setUploadedFiles(acceptedFiles)
                uploadFile(file)
              }}
              onError={(error) => toast.error(error.message)}
            >
              <DropzoneContent />
              <DropzoneEmptyState />
            </Dropzone>
            {uploadCsv.isPending ? (
              <div className="grid gap-1 rounded-lg border p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                  File loaded. Generating suggestions...
                </div>
                <div>
                  OpenRouter is categorizing rows when available; keyword rules are used automatically as fallback.
                </div>
              </div>
            ) : null}
            <div className="grid gap-2 rounded-lg border p-3 text-xs">
              <div className="flex justify-between gap-3"><span>Active import</span><span>{activeImport?.filename ?? "none"}</span></div>
              <div className="flex justify-between gap-3"><span>Status</span><span>{activeImport ? <ImportStatusBadge status={activeImport.status} /> : "none"}</span></div>
              <div className="flex justify-between gap-3"><span>Delimiter</span><span>{activeImport?.delimiter ?? "-"}</span></div>
              <div className="flex justify-between gap-3"><span>Encoding</span><span>{activeImport?.encoding ?? "-"}</span></div>
              <div className="flex justify-between gap-3"><span>Header row</span><span>{activeImport?.headerRow ?? "-"}</span></div>
              <div className="flex justify-between gap-3"><span>Rows</span><span>{activeImport?.rowCount ?? 0}</span></div>
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
            <CardDescription>These headers are sent with the upload. The parser also auto-detects common CSV shapes.</CardDescription>
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
                <Button type="submit" disabled={uploadCsv.isPending}>Save mapping</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader><CardDescription>Approved rows</CardDescription><CardTitle>{approvedCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Low confidence</CardDescription><CardTitle>{lowConfidenceCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Blocked rows</CardDescription><CardTitle>{blockedCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Ready to commit</CardDescription><CardTitle>{committableCount}</CardTitle></CardHeader></Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Staging review</CardTitle>
          <CardDescription>AI-style suggestions are drafts. Low-confidence rows require human confirmation before commit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-xs">
            <div className="text-muted-foreground">
              Showing {stagedRows.length} of {totalRows} staged rows. Suggestions use OpenRouter when available, with keyword rules as fallback.
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Review filter</span>
              <Select
                value={stagedReviewDraft ?? "all"}
                onValueChange={(value) => setStagedReviewDraft(value === "all" ? null : value as CsvStagedRow["reviewState"])}
              >
                <SelectTrigger className="h-8 w-40" aria-label="Review state filter">
                  <StagedSelectValue>
                    {stagedReviewDraft === "approved"
                      ? "Approved"
                      : stagedReviewDraft === "needs_human"
                        ? "Needs human"
                        : stagedReviewDraft === "blocked"
                          ? "Blocked"
                          : "All rows"}
                  </StagedSelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All rows</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="needs_human">Needs human</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={() => setStagedReviewDraft(null)}>
                Clear
              </Button>
              <Button type="button" size="sm" onClick={() => setStagedReviewState(stagedReviewDraft)}>
                Save
              </Button>
            </div>
          </div>
          {isActiveImportCommitted ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              This import has been committed to the ledger. Staged rows are kept as audit history, but editing/review actions are closed for committed imports.
            </div>
          ) : importsQuery.isPending || stagedRowsQuery.isPending ? (
            <div className="flex items-center gap-2 rounded-md border p-3 text-xs text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading import rows...
            </div>
          ) : (
            <DataTable
              data={stagedRows}
              columns={stagedColumns}
              getRowId={(row) => row.id}
              enableRowSelection
              bulkActions={StagedBulkActions}
              searchPlaceholder="Search staged rows"
              initialPageSize={5}
              emptyMessage="No staged rows yet. Upload a CSV to start review."
              wide
              serverSide
              pageCount={pageCount}
              totalRows={totalRows}
              controlledPagination={controlledPagination}
              controlledSorting={controlledSorting}
              controlledSearch={stagedSearch ?? ""}
              onPaginationChange={setStagedPagination}
              onSortingChange={setStagedSorting}
              onSearchChange={setStagedSearch}
            />
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button
          disabled={!isActiveImportReviewable || blockedCount > 0 || lowConfidenceCount > 0 || committableCount === 0 || commitImport.isPending}
          onClick={commitApprovedRows}
        >
          {commitImport.isPending ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
          Commit approved rows
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Import audit and reversibility</CardTitle>
          <CardDescription>
            Committed CSV rows are traceable through their import attachment URL and can be soft-reversed from the audit record.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-xs">
            <span>Audit status: {activeImport?.status ?? "none"}</span>
            <span>Duplicate file status: {duplicateImport?.status ?? "none"}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeImport || activeImport.status !== "committed" || reverseImport.isPending}
              onClick={reverseCommittedImport}
            >
              {reverseImport.isPending ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
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
              No rows committed in this session. Approved CSV rows will appear in the ledger with source = csv after commit.
            </div>
          )}
        </CardContent>
      </Card>
      </PageShell>
    </TooltipProvider>
  )
}
