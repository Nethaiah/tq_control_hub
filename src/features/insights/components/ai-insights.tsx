"use client"

import Link from "next/link"
import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { BotIcon, CheckIcon, FileTextIcon, FilterIcon, LineChartIcon, ScanTextIcon, XIcon } from "lucide-react"

import { HelpDialog } from "@/components/common/help-dialog"
import { PageHeader, PageShell } from "@/components/common/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { aiQueryFormSchema } from "@/domain/schemas"
import type { AiQueryFormValues, AiSuggestion } from "@/domain/types"
import { formatCurrency } from "@/domain/currency"

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
}: {
  feature: "briefing" | "forecast" | "ocr"
  items: AiSuggestion[]
  onUpdate: (id: string, reviewState: AiSuggestion["reviewState"]) => void
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
      </CardHeader>
      <CardContent className="grid gap-3">
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
              <Button size="sm" onClick={() => onUpdate(item.id, "applied")}>
                <CheckIcon data-icon="inline-start" />
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onUpdate(item.id, "dismissed")}>
                <XIcon data-icon="inline-start" />
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function AiInsights({
  suggestions,
  queryBreakdown,
}: {
  suggestions: AiSuggestion[]
  queryBreakdown: Array<{ category: string; amount: number; transactionIds: string[] }>
}) {
  const [items, setItems] = React.useState(suggestions)
  const [queryVisible, setQueryVisible] = React.useState(true)
  const form = useForm<AiQueryFormValues>({
    resolver: zodResolver(aiQueryFormSchema as never) as never,
    defaultValues: { question: "Show me why development costs are high this month" },
  })
  const querySuggestion = items.find((item) => item.feature === "natural_language_query")
  const briefingItems = items.filter((item) => item.feature === "briefing")
  const forecastItems = items.filter((item) => item.feature === "forecast")
  const ocrItems = items.filter((item) => item.feature === "ocr")

  function updateSuggestion(id: string, reviewState: AiSuggestion["reviewState"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, reviewState } : item))
    toast.success(reviewState === "applied" ? "Suggestion applied" : "Suggestion dismissed")
  }

  function onQuery(values: AiQueryFormValues) {
    setQueryVisible(true)
    toast.success("Question converted into existing filters", {
      description: values.question,
    })
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
                  <Button size="sm" onClick={() => updateSuggestion(item.id, "applied")}>
                    <CheckIcon data-icon="inline-start" />
                    Apply suggestion
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => updateSuggestion(item.id, "dismissed")}>
                    <XIcon data-icon="inline-start" />
                    Dismiss
                  </Button>
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
                <Button type="submit">Convert to filters</Button>
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
                  {queryBreakdown.map((row) => (
                    <div key={row.category} className="flex items-center justify-between gap-3 rounded-md bg-background p-2 text-xs">
                      <span>{row.category}</span>
                      <span className="font-mono font-medium tabular-nums">{formatCurrency(row.amount)}</span>
                    </div>
                  ))}
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
        <AiFeaturePanel feature="briefing" items={briefingItems} onUpdate={updateSuggestion} />
        <AiFeaturePanel feature="forecast" items={forecastItems} onUpdate={updateSuggestion} />
        <AiFeaturePanel feature="ocr" items={ocrItems} onUpdate={updateSuggestion} />
      </div>
    </PageShell>
  )
}
