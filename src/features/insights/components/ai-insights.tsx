"use client"

import Link from "next/link"
import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { BotIcon, CheckIcon, FileTextIcon, FilterIcon, LineChartIcon, Loader2Icon, ScanTextIcon, XIcon } from "lucide-react"

import { HelpDialog } from "@/components/common/help-dialog"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { aiQueryFormSchema } from "@/domain/schemas"
import type { AiQueryFormValues, AiSuggestion } from "@/domain/types"
import { formatCurrency } from "@/domain/currency"
import {
  type AiQueryResult,
  type AiQuerySourceRow,
  useAiSuggestions,
  useGenerateBriefing,
  useGenerateForecast,
  useRunAiQuery,
  useUpdateAiSuggestion,
} from "@/features/insights/hooks/use-ai-insights-queries"

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

function AiFeaturePanel({
  feature,
  items,
  onUpdate,
  actions,
  emptyNote,
}: {
  feature: "briefing" | "forecast" | "ocr"
  items: AiSuggestion[]
  onUpdate: (id: string, reviewState: AiSuggestion["reviewState"]) => void
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
            <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
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
                  <Button size="sm" onClick={() => onUpdate(item.id, "applied")}>
                    <CheckIcon data-icon="inline-start" />
                    Confirm
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
  const runQuery = useRunAiQuery()
  const updateSuggestionMutation = useUpdateAiSuggestion()
  const generateBriefing = useGenerateBriefing()
  const generateForecast = useGenerateForecast()
  const [queryResult, setQueryResult] = React.useState<AiQueryResult | null>(null)
  const [queryVisible, setQueryVisible] = React.useState(false)
  const form = useForm<AiQueryFormValues>({
    resolver: zodResolver(aiQueryFormSchema as never) as never,
    defaultValues: { question: "Show me why development costs are high this month" },
  })
  const items = suggestionsQuery.data ?? []
  const querySuggestion = queryResult?.suggestion ?? items.find((item) => item.feature === "natural_language_query")
  const queryBreakdown = queryResult?.breakdown ?? []
  const querySourceRows = queryResult?.sourceRows ?? []
  const briefingItems = items.filter((item) => item.feature === "briefing")
  const forecastItems = items.filter((item) => item.feature === "forecast")
  const ocrItems = items.filter((item) => item.feature === "ocr")

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

  if (suggestionsQuery.isLoading) {
    return (
      <PageShell>
        <PageHeader
          title="AI insights"
          description="AI suggestions are drafts with confidence, human review states, and traceability to rows or filters."
        />
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </PageShell>
    )
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
            {items.filter((item) => item.feature === "categorization" || item.feature === "anomaly").length === 0 ? (
              <p className="text-sm text-muted-foreground">Upload and categorize CSV rows to create reviewable suggestions.</p>
            ) : null}
            {items.filter((item) => item.feature === "categorization" || item.feature === "anomaly").map((item) => (
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
      <div className="grid gap-4 xl:grid-cols-3">
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
          emptyNote={
            <>
              <span className="font-medium text-foreground">MVP note: </span>
              Receipt / invoice OCR requires a multimodal model to parse images. No compatible model is configured yet. This will be added when a vision-capable model is available via OpenRouter or alternative providers.
            </>
          }
        />
      </div>
    </PageShell>
  )
}
