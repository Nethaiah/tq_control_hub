"use client"

import Link from "next/link"
import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AlertTriangleIcon, BotIcon, CheckIcon, FileTextIcon, FilterIcon, LineChartIcon, Loader2Icon, ScanTextIcon, XIcon } from "lucide-react"

import { DatePicker } from "@/components/common/date-picker"
import { HelpDialog } from "@/components/common/help-dialog"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { aiQueryFormSchema, manualTransactionFormSchema } from "@/domain/schemas"
import type { AiQueryFormValues, AiSuggestion, Category, Department, ManualTransactionFormValues } from "@/domain/types"
import { formatCurrency } from "@/domain/currency"
import {
  type AiQueryResult,
  type AiQuerySourceRow,
  useCreateOcrLedgerTransaction,
  useAiSuggestions,
  useGenerateBriefing,
  useGenerateForecast,
  useGenerateOcrDraft,
  useOcrLedgerLookups,
  useRunAiQuery,
  useUpdateAiSuggestion,
} from "@/features/insights/hooks/use-ai-insights-queries"

type OcrDraftTransaction = {
  amount: number | null
  categoryId: string | null
  categoryName: string | null
  currency: "AED" | "USD" | null
  date: string | null
  departmentId: string | null
  departmentName: string | null
  description: string
  lineItems: string[]
  vendor: string | null
}

type OcrProposedAction = {
  draftTransaction?: Partial<OcrDraftTransaction> & { source?: string; type?: string }
  guardrail?: string
  parse?: {
    filename?: string
    jobId?: string | null
    provider?: string
    tier?: string
  }
}

type OcrFilePreview = {
  mimeType: string
  name: string
  url: string
}

const aiFeatureCopy = {
  briefing: {
    title: "Monthly briefing",
    description: "Plain-English owner summary generated from traceable aggregate rows.",
    icon: FileTextIcon,
  },
  forecast: {
    title: "Forecasting",
    description: "Projection only. Assumptions are visible and must not be treated as booked revenue.",
    icon: LineChartIcon,
  },
  ocr: {
    title: "Receipt / invoice OCR",
    description: "Creates a draft transaction only. Human confirmation is required before commit.",
    icon: ScanTextIcon,
  },
} satisfies Partial<Record<AiSuggestion["feature"], { title: string; description: string; icon: typeof BotIcon }>>

function parseOcrProposedAction(item: AiSuggestion): OcrProposedAction | null {
  if (item.feature !== "ocr") return null

  try {
    const parsed = JSON.parse(item.proposedAction) as unknown
    return parsed && typeof parsed === "object" ? parsed as OcrProposedAction : null
  } catch {
    return null
  }
}

function defaultOcrFormValues(item: AiSuggestion | null): ManualTransactionFormValues {
  const action = item ? parseOcrProposedAction(item) : null
  const draft = action?.draftTransaction

  return {
    amount: typeof draft?.amount === "number" ? draft.amount : 0,
    categoryId: typeof draft?.categoryId === "string" ? draft.categoryId : "",
    clientId: "",
    currency: draft?.currency === "AED" || draft?.currency === "USD" ? draft.currency : "USD",
    date: typeof draft?.date === "string" ? draft.date : "",
    departmentId: typeof draft?.departmentId === "string" ? draft.departmentId : "",
    description: typeof draft?.description === "string" && draft.description.trim() ? draft.description : item?.title ?? "OCR receipt expense",
    subcategoryId: "",
    type: "expense",
    vendor: typeof draft?.vendor === "string" ? draft.vendor : "",
  }
}

function nameById(items: Array<{ id: string; name: string }>, id?: string | null) {
  return id ? items.find((item) => item.id === id)?.name ?? "Unknown" : "Unmapped"
}

function isReviewableSuggestion(item: AiSuggestion) {
  return item.reviewState === "draft" || item.reviewState === "needs_human"
}

function AiFeaturePanel({
  feature,
  items,
  onUpdate,
  onOcrCommit,
  actions,
  emptyNote,
}: {
  feature: "briefing" | "forecast" | "ocr"
  items: AiSuggestion[]
  onUpdate: (id: string, reviewState: AiSuggestion["reviewState"]) => void
  onOcrCommit?: (item: AiSuggestion) => void
  actions?: React.ReactNode
  emptyNote?: React.ReactNode
}) {
  const copy = aiFeatureCopy[feature]
  const Icon = copy.icon

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon />
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
        {actions ? <div className="mt-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.length === 0 && emptyNote ? (
          <div className="rounded-md border border-dashed bg-muted/35 p-3 text-xs text-muted-foreground">
            {emptyNote}
          </div>
        ) : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{item.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
              </div>
              <Badge variant={item.confidence < 0.7 ? "destructive" : "outline"}>
                {Math.round(item.confidence * 100)}%
              </Badge>
            </div>
            <div className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              {item.proposedAction}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{item.reviewState}</Badge>
              {item.filterQuery ? (
                <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/ledger?${item.filterQuery}`} />}>
                  <FilterIcon data-icon="inline-start" />
                  Trace claims
                </Button>
              ) : null}
              {item.reviewState === "draft" || item.reviewState === "needs_human" ? (
                <>
                  <Button size="sm" onClick={() => feature === "ocr" ? onOcrCommit?.(item) : onUpdate(item.id, "applied")}>
                    <CheckIcon data-icon="inline-start" />
                    {feature === "ocr" ? "Review & insert" : "Confirm"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onUpdate(item.id, "dismissed")}>
                    <XIcon data-icon="inline-start" />
                    Dismiss
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function OcrLedgerCommitDialog({
  categories,
  departments,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  preview,
  suggestion,
}: {
  categories: Category[]
  departments: Department[]
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ManualTransactionFormValues) => Promise<void> | void
  open: boolean
  preview?: OcrFilePreview
  suggestion: AiSuggestion | null
}) {
  const form = useForm<ManualTransactionFormValues>({
    resolver: zodResolver(manualTransactionFormSchema as never) as never,
    defaultValues: defaultOcrFormValues(suggestion),
  })
  const action = suggestion ? parseOcrProposedAction(suggestion) : null
  const draft = action?.draftTransaction
  const expenseCategories = categories.filter((category) => category.kind === "expense" && category.parentId === null && !category.archived)

  React.useEffect(() => {
    form.reset(defaultOcrFormValues(suggestion))
  }, [form, suggestion])

  async function submit(values: ManualTransactionFormValues) {
    await onSubmit({ ...values, type: "expense", clientId: "" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Review OCR draft before ledger insert</DialogTitle>
          <DialogDescription>
            Complete or correct the extracted fields. Submitting this form creates a real expense row in the ledger.
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>This will insert into the ledger</AlertTitle>
          <AlertDescription>
            OCR can misread dates, currencies, vendors, or totals. Confirm these fields against the uploaded receipt or invoice before creating the transaction.
          </AlertDescription>
        </Alert>
        {draft?.lineItems?.length ? (
          <div className="grid gap-1 rounded-md border bg-muted/25 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Extracted line items</div>
            {draft.lineItems.slice(0, 5).map((lineItem) => (
              <div key={lineItem} className="truncate">{lineItem}</div>
            ))}
          </div>
        ) : null}
        {preview ? (
          <div className="grid gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-medium">Uploaded file preview</div>
                <div className="text-muted-foreground">{preview.name}</div>
              </div>
              <Button nativeButton={false} variant="outline" size="sm" render={<a href={preview.url} target="_blank" rel="noreferrer" />}>
                Open file
              </Button>
            </div>
            <object
              aria-label={`Preview of ${preview.name}`}
              className="h-80 w-full rounded-md border bg-muted/20"
              data={preview.url}
              type={preview.mimeType || undefined}
            >
              <div className="p-4 text-xs text-muted-foreground">
                Preview is unavailable in this browser. Open the uploaded file in a new tab instead.
              </div>
            </object>
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/25 p-3 text-xs text-muted-foreground">
            File preview is available immediately after upload. Older OCR drafts may not show a preview until attachment storage is added.
          </div>
        )}
        <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.date}>
                <FieldLabel>Date</FieldLabel>
                <DatePicker value={form.watch("date") ?? ""} onChange={(value) => form.setValue("date", value, { shouldValidate: true })} />
                <FieldError errors={[form.formState.errors.date]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.amount}>
                <FieldLabel htmlFor="ocr-amount">Amount</FieldLabel>
                <Input id="ocr-amount" type="number" step="0.01" aria-invalid={!!form.formState.errors.amount} {...form.register("amount")} />
                <FieldError errors={[form.formState.errors.amount]} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Currency</FieldLabel>
                <Select value={form.watch("currency")} onValueChange={(value) => form.setValue("currency", value as "AED" | "USD", { shouldValidate: true })}>
                  <SelectTrigger className="w-full" aria-label="OCR currency">
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
              <Field data-invalid={!!form.formState.errors.departmentId}>
                <FieldLabel>Department</FieldLabel>
                <Select value={form.watch("departmentId")} onValueChange={(value) => form.setValue("departmentId", value ?? "", { shouldValidate: true })}>
                  <SelectTrigger className="w-full" aria-label="OCR department">
                    <span className="line-clamp-1 flex-1 text-left">{nameById(departments, form.watch("departmentId"))}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.departmentId]} />
              </Field>
            </div>
            <Field data-invalid={!!form.formState.errors.categoryId}>
              <FieldLabel>Expense category</FieldLabel>
              <Select value={form.watch("categoryId")} onValueChange={(value) => form.setValue("categoryId", value ?? "", { shouldValidate: true })}>
                <SelectTrigger className="w-full" aria-label="OCR category">
                  <span className="line-clamp-1 flex-1 text-left">{nameById(categories, form.watch("categoryId"))}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError errors={[form.formState.errors.categoryId]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.description}>
              <FieldLabel htmlFor="ocr-description">Description</FieldLabel>
              <Input id="ocr-description" aria-invalid={!!form.formState.errors.description} {...form.register("description")} />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ocr-vendor">Vendor</FieldLabel>
              <Input id="ocr-vendor" placeholder="Vendor name" {...form.register("vendor")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
              Create ledger transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SourceRows({ rows }: { rows: AiQuerySourceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md bg-background p-2 text-xs text-muted-foreground">
        No ledger rows matched these filters. The answer above does not infer numbers outside the ledger.
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {rows.slice(0, 5).map((row) => (
        <div key={row.id} className="grid gap-1 rounded-md bg-background p-2 text-xs sm:grid-cols-[6rem_1fr_auto] sm:items-center">
          <span className="font-mono text-muted-foreground">{row.date}</span>
          <span>
            {row.description}
            <span className="text-muted-foreground"> · {row.department ?? "No department"} · {row.category ?? "No category"}</span>
          </span>
          <span className="font-mono font-medium tabular-nums">{formatCurrency(row.amountUsd)}</span>
        </div>
      ))}
      {rows.length > 5 ? (
        <p className="text-xs text-muted-foreground">Showing 5 of {rows.length} source rows. Open the ledger for the full source set.</p>
      ) : null}
    </div>
  )
}

export function AiInsights() {
  const suggestionsQuery = useAiSuggestions()
  const ocrLookupsQuery = useOcrLedgerLookups()
  const runQuery = useRunAiQuery()
  const updateSuggestionMutation = useUpdateAiSuggestion()
  const createOcrLedgerTransaction = useCreateOcrLedgerTransaction()
  const generateBriefing = useGenerateBriefing()
  const generateForecast = useGenerateForecast()
  const generateOcrDraft = useGenerateOcrDraft()
  const [queryResult, setQueryResult] = React.useState<AiQueryResult | null>(null)
  const [queryVisible, setQueryVisible] = React.useState(false)
  const [ocrUploadedFiles, setOcrUploadedFiles] = React.useState<File[] | undefined>(undefined)
  const [ocrPreviews, setOcrPreviews] = React.useState<Record<string, OcrFilePreview>>({})
  const ocrPreviewsRef = React.useRef<Record<string, OcrFilePreview>>({})
  const [ocrSuggestionToCommit, setOcrSuggestionToCommit] = React.useState<AiSuggestion | null>(null)
  const form = useForm<AiQueryFormValues>({
    resolver: zodResolver(aiQueryFormSchema as never) as never,
    defaultValues: { question: "Show me why development costs are high this month" },
  })
  const items = suggestionsQuery.data ?? []
  const querySuggestion = queryResult?.suggestion ?? items.find((item) => item.feature === "natural_language_query")
  const queryBreakdown = queryResult?.breakdown ?? []
  const querySourceRows = queryResult?.sourceRows ?? []
  const reviewableItems = items.filter(isReviewableSuggestion)
  const categorizationItems = reviewableItems.filter((item) => item.feature === "categorization" || item.feature === "anomaly")
  const briefingItems = reviewableItems.filter((item) => item.feature === "briefing")
  const forecastItems = reviewableItems.filter((item) => item.feature === "forecast")
  const ocrItems = reviewableItems.filter((item) => item.feature === "ocr")
  const ocrDepartments = ocrLookupsQuery.data.departments
  const ocrCategories = ocrLookupsQuery.data.categories

  React.useEffect(() => {
    return () => {
      for (const preview of Object.values(ocrPreviewsRef.current)) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [])

  function updateSuggestion(id: string, reviewState: AiSuggestion["reviewState"]) {
    updateSuggestionMutation.mutate({ id, reviewState }, {
      onSuccess: () => {
        toast.success(reviewState === "applied" ? "Suggestion applied" : "Suggestion dismissed")
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Unable to update suggestion")
      },
    })
  }

  function onQuery(values: AiQueryFormValues) {
    runQuery.mutate(values.question, {
      onSuccess: (data) => {
        setQueryResult(data)
        setQueryVisible(true)
        toast.success("Question converted into existing filters", {
          description: `${data.totals.rowCount} ledger row${data.totals.rowCount === 1 ? "" : "s"} matched`,
        })
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Unable to convert question")
      },
    })
  }

  function onGenerateBriefing() {
    generateBriefing.mutate(undefined, {
      onSuccess: () => {
        toast.success("Monthly briefing generated")
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Unable to generate briefing")
      },
    })
  }

  function onGenerateForecast() {
    generateForecast.mutate(undefined, {
      onSuccess: () => {
        toast.success("Forecast generated")
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Unable to generate forecast")
      },
    })
  }

  function onGenerateOcrDraft(file: File) {
    generateOcrDraft.mutate(file, {
      onSuccess: (data) => {
        const previewUrl = URL.createObjectURL(file)
        setOcrPreviews((current) => {
          const previous = current[data.suggestion.id]
          if (previous) URL.revokeObjectURL(previous.url)

          const next = {
            ...current,
            [data.suggestion.id]: {
              mimeType: file.type,
              name: file.name,
              url: previewUrl,
            },
          }
          ocrPreviewsRef.current = next
          return next
        })
        toast.success("OCR draft created", {
          description: `${data.draft.vendor ?? "Receipt"} · ${Math.round(data.suggestion.confidence * 100)}% confidence`,
        })
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Unable to parse receipt")
      },
    })
  }

  async function onCreateLedgerTransactionFromOcr(values: ManualTransactionFormValues) {
    if (!ocrSuggestionToCommit) return

    try {
      const data = await createOcrLedgerTransaction.mutateAsync(values)
      await updateSuggestionMutation.mutateAsync({ id: ocrSuggestionToCommit.id, reviewState: "applied" })
      setOcrSuggestionToCommit(null)
      toast.success("Ledger transaction created", {
        description: `${data.transaction.description} was inserted from OCR review.`,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create ledger transaction")
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="AI insights"
        description="AI suggestions are drafts with confidence, human review states, and traceability to rows or filters."
        actions={
          <HelpDialog title="Drafts until confirmed">
            AI can suggest categories or filters, but it cannot commit anything that touches the books without owner action.
          </HelpDialog>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Automatic categorization</CardTitle>
            <CardDescription>Imported rows with confidence and human-in-the-loop controls.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {categorizationItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Upload and categorize CSV rows to create reviewable suggestions.</p>
            ) : null}
            {categorizationItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                  </div>
                  <Badge variant={item.confidence < 0.7 ? "destructive" : "outline"}>
                    {Math.round(item.confidence * 100)}%
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.reviewState}</Badge>
                  {item.filterQuery ? (
                    <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/ledger?${item.filterQuery}`} />}>
                      <FilterIcon data-icon="inline-start" />
                      Open source rows
                    </Button>
                  ) : null}
                  {item.reviewState === "draft" || item.reviewState === "needs_human" ? (
                    <>
                      <Button size="sm" onClick={() => updateSuggestion(item.id, "applied")}>
                        <CheckIcon data-icon="inline-start" />
                        Apply suggestion
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => updateSuggestion(item.id, "dismissed")}>
                        <XIcon data-icon="inline-start" />
                        Dismiss
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Natural language query</CardTitle>
            <CardDescription>Converts an owner question into filters and derived data without inventing numbers.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form onSubmit={form.handleSubmit(onQuery)}>
              <FieldGroup>
                <Field data-invalid={!!form.formState.errors.question}>
                  <FieldLabel htmlFor="ai-question">Owner question</FieldLabel>
                  <Textarea id="ai-question" aria-invalid={!!form.formState.errors.question} {...form.register("question")} />
                  <FieldError errors={[form.formState.errors.question]} />
                </Field>
                <Button type="submit" disabled={runQuery.isPending}>
                  {runQuery.isPending ? "Converting..." : "Convert to filters"}
                </Button>
              </FieldGroup>
            </form>
            {queryVisible && querySuggestion ? (
              <div className="rounded-lg border bg-muted/35 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{querySuggestion.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{querySuggestion.summary}</p>
                  </div>
                  <Badge variant="outline">{querySuggestion.transactionIds.length} rows</Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  <p className="rounded-md bg-background p-3 text-sm leading-relaxed">
                    {queryResult?.answer ?? querySuggestion.summary}
                  </p>
                  {queryResult?.comparison ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[queryResult.comparison.left, queryResult.comparison.right].map((side) => (
                        <div key={side.label} className="rounded-md bg-background p-3 text-xs">
                          <div className="font-medium capitalize">{side.label}</div>
                          <div className="mt-1 text-muted-foreground">{side.totals.rowCount} source rows</div>
                          <Button nativeButton={false} className="mt-2" variant="outline" size="sm" render={<Link href={`/ledger?${side.filterQuery}`} />}>
                            <FilterIcon data-icon="inline-start" />
                            Open {side.label}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {queryBreakdown.length > 0 ? queryBreakdown.map((row) => (
                    <div key={row.category} className="flex items-center justify-between gap-3 rounded-md bg-background p-2 text-xs">
                      <span>{row.category}</span>
                      <span className="font-mono font-medium tabular-nums">{formatCurrency(row.amount)}</span>
                    </div>
                  )) : null}
                  <SourceRows rows={querySourceRows} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button nativeButton={false} variant="outline" render={<Link href={`/ledger?${querySuggestion.filterQuery}`} />}>
                    <FilterIcon data-icon="inline-start" />
                    Open filtered ledger
                  </Button>
                  <Button variant="ghost" onClick={() => setQueryVisible(false)}>Dismiss</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <AiFeaturePanel
          feature="briefing"
          items={briefingItems}
          onUpdate={updateSuggestion}
          actions={
            <Button size="sm" disabled={generateBriefing.isPending} onClick={onGenerateBriefing}>
              {generateBriefing.isPending ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
              Generate briefing
            </Button>
          }
        />
        <AiFeaturePanel
          feature="forecast"
          items={forecastItems}
          onUpdate={updateSuggestion}
          actions={
            <Button size="sm" disabled={generateForecast.isPending} onClick={onGenerateForecast}>
              {generateForecast.isPending ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
              Generate forecast
            </Button>
          }
        />
        <AiFeaturePanel
          feature="ocr"
          items={ocrItems}
          onUpdate={updateSuggestion}
          onOcrCommit={setOcrSuggestionToCommit}
          actions={
            <div className="grid gap-2">
              <Dropzone
                accept={{
                  "application/pdf": [".pdf"],
                  "image/heic": [".heic"],
                  "image/heif": [".heif"],
                  "image/jpeg": [".jpg", ".jpeg"],
                  "image/png": [".png"],
                  "image/webp": [".webp"],
                }}
                className="p-4"
                disabled={generateOcrDraft.isPending}
                maxFiles={1}
                maxSize={10 * 1024 * 1024}
                src={ocrUploadedFiles}
                onDrop={(acceptedFiles) => {
                  const file = acceptedFiles[0]
                  if (!file) return
                  setOcrUploadedFiles(acceptedFiles)
                  onGenerateOcrDraft(file)
                }}
                onError={(error) => toast.error(error.message)}
              >
                <DropzoneContent />
                <DropzoneEmptyState />
              </Dropzone>
              {generateOcrDraft.isPending ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/35 p-2 text-xs text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  LlamaParse is extracting a draft transaction. Nothing is committed to the ledger.
                </div>
              ) : null}
            </div>
          }
          emptyNote={
            <>
              <span className="font-medium text-foreground">Draft only: </span>
              Upload a receipt or invoice photo/PDF to extract a proposed expense. Confirming the AI suggestion marks it reviewed; it does not silently write to the ledger.
            </>
          }
        />
      </div>
      <OcrLedgerCommitDialog
        categories={ocrCategories}
        departments={ocrDepartments}
        isSubmitting={createOcrLedgerTransaction.isPending || updateSuggestionMutation.isPending}
        open={!!ocrSuggestionToCommit}
        preview={ocrSuggestionToCommit ? ocrPreviews[ocrSuggestionToCommit.id] : undefined}
        suggestion={ocrSuggestionToCommit}
        onOpenChange={(open) => {
          if (!open) setOcrSuggestionToCommit(null)
        }}
        onSubmit={onCreateLedgerTransactionFromOcr}
      />
    </PageShell>
  )
}
