import { OpenRouter } from "@openrouter/sdk"

import type { Category, Client, Department } from "@/domain/types"
import type { MetricsFilter } from "@/lib/api/filters"
import type { ParsedCsvStagedRow, ParsedCsvUpload } from "@/lib/csv/parser"

type AiCategorization = {
  categoryName?: string
  confidence?: number
  departmentName?: string
  index: number
}

export type AiCategorizationRowInput = {
  amount?: number | null
  currency?: "USD" | "AED" | null
  description: string
  rawDate?: string | null
}

export type AiCategorizationResult = AiCategorization & {
  categoryId?: string
  departmentId?: string
}

type AiQueryTranslation = {
  categoryName?: string
  clientOrVendor?: string
  confidence?: number
  departmentName?: string
  from?: string
  rationale?: string
  search?: string
  source?: "manual" | "csv" | "automation"
  to?: string
  type?: "revenue" | "expense"
}

export type AiQueryTranslationResult = {
  confidence: number
  filters: MetricsFilter
  rationale: string
}

const DEFAULT_MODEL = "cohere/north-mini-code:free"

function logOpenRouterError(error: unknown) {
  if (error && typeof error === "object") {
    const maybeError = error as {
      error?: { code?: number | string; message?: string; metadata?: { provider_name?: string; raw?: string } }
      statusCode?: number
    }

    console.error("[OpenRouter CSV categorization failed]", {
      code: maybeError.error?.code,
      message: maybeError.error?.message ?? "OpenRouter request failed",
      provider: maybeError.error?.metadata?.provider_name,
      reason: maybeError.error?.metadata?.raw,
      statusCode: maybeError.statusCode,
    })
    return
  }

  console.error("[OpenRouter CSV categorization failed]", error)
}

function contentToText(content: unknown) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map((part) => {
      if (typeof part === "string") return part
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text
      return ""
    })
    .join("\n")
}

function parseJsonArray(text: string): AiCategorization[] {
  const trimmed = text.trim()
  const jsonText = trimmed.startsWith("[") ? trimmed : trimmed.match(/\[[\s\S]*\]/)?.[0]
  if (!jsonText) return []

  const parsed = JSON.parse(jsonText) as unknown
  if (!Array.isArray(parsed)) return []

  return parsed.filter((item): item is AiCategorization => Boolean(item && typeof item === "object" && "index" in item))
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return null

  const parsed = JSON.parse(jsonText) as unknown
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
}

function byName<T extends { name: string }>(items: T[], name: string | undefined) {
  if (!name) return null
  const normalized = name.trim().toLowerCase()
  return items.find((item) => item.name.toLowerCase() === normalized) ?? null
}

function includesName<T extends { name: string }>(items: T[], text: string) {
  const normalized = text.toLowerCase()
  return items.find((item) => normalized.includes(item.name.toLowerCase())) ?? null
}

function monthRange(offsetMonths = 0) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function quarterRange(offsetQuarters = 0) {
  const now = new Date()
  const currentQuarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3
  const startMonth = currentQuarterStartMonth + offsetQuarters * 3
  const start = new Date(Date.UTC(now.getUTCFullYear(), startMonth, 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0))

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function safeDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function heuristicFilters(question: string, lookup: { categories: Category[]; clients: Client[]; departments: Department[] }): AiQueryTranslationResult {
  const text = question.toLowerCase()
  const range = text.includes("last quarter")
    ? quarterRange(-1)
    : text.includes("quarter")
      ? quarterRange()
      : text.includes("last month")
        ? monthRange(-1)
        : monthRange()
  const department = includesName(lookup.departments, text)
  const category = includesName(
    lookup.categories.filter((item) => !item.archived),
    text
  )
  const client = includesName(lookup.clients, text)
  const type = text.includes("revenue") || text.includes("income") || text.includes("mrr")
    ? "revenue"
    : text.includes("expense") || text.includes("spend") || text.includes("cost") || text.includes("burn")
      ? "expense"
      : undefined

  return {
    confidence: 0.62,
    filters: {
      ...range,
      ...(type ? { type } : {}),
      ...(department ? { departmentId: department.id } : {}),
      ...(category ? { categoryId: category.id } : {}),
      ...(client ? { clientOrVendor: client.id } : {}),
    },
    rationale: "Fallback parser matched dates, departments, categories, clients, and transaction type from the question.",
  }
}

function applySuggestions(
  rows: ParsedCsvStagedRow[],
  suggestions: AiCategorization[],
  departments: Department[],
  categories: Category[]
): ParsedCsvStagedRow[] {
  const expenseCategories = categories.filter((category) => category.kind === "expense" && !category.parentId && !category.archived)
  const byIndex = new Map(suggestions.map((suggestion) => [suggestion.index, suggestion]))

  return rows.map((row, index) => {
    const suggestion = byIndex.get(index)
    const department = byName(departments, suggestion?.departmentName)
    const category = byName(expenseCategories, suggestion?.categoryName)

    if (!department && !category) return row

    const confidence = typeof suggestion?.confidence === "number"
      ? Math.min(0.99, Math.max(0, suggestion.confidence))
      : row.confidence
    const nextRow = {
      ...row,
      confidence,
      suggestionModel: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      suggestionSource: "openrouter" as const,
      suggestedCategoryId: category?.id ?? row.suggestedCategoryId,
      suggestedDepartmentId: department?.id ?? row.suggestedDepartmentId,
    }

    const reviewState: ParsedCsvStagedRow["reviewState"] = nextRow.validationIssues.length > 0
      ? "blocked"
      : confidence >= 0.85
        ? "approved"
        : "needs_human"

    return {
      ...nextRow,
      reviewState,
    }
  })
}

export async function categorizeCsvUploadWithOpenRouter(upload: ParsedCsvUpload, lookup: {
  categories: Category[]
  departments: Department[]
}): Promise<ParsedCsvUpload> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || upload.rows.length === 0) return upload

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  const client = new OpenRouter({ apiKey })
  const expenseCategories = lookup.categories.filter((category) => category.kind === "expense" && !category.parentId && !category.archived)

  try {
    const response = await client.chat.send({
      chatRequest: {
        model,
        messages: [
          {
            role: "system",
            content: "You categorize CSV expense rows. Return only valid JSON, no markdown. Use only the allowed departmentName and categoryName values. Low confidence should be below 0.7.",
          },
          {
            role: "user",
            content: JSON.stringify({
              allowedCategories: expenseCategories.map((category) => category.name),
              allowedDepartments: lookup.departments.map((department) => department.name),
              expectedOutput: [{ categoryName: "string", confidence: 0.82, departmentName: "string", index: 0 }],
              rows: upload.rows.map((row, index) => ({
                amount: row.parsedAmount ?? row.rawAmount,
                currency: row.currency,
                description: row.rawDescription,
                index,
                rawDate: row.rawDate,
              })),
            }),
          },
        ],
        temperature: 0.1,
      },
    })
    const text = contentToText(response.choices[0]?.message.content)
    const suggestions = parseJsonArray(text)

    return {
      ...upload,
      rows: applySuggestions(upload.rows, suggestions, lookup.departments, lookup.categories),
    }
  } catch (error) {
    logOpenRouterError(error)
    return upload
  }
}

export async function categorizeRowsWithOpenRouter(
  rows: AiCategorizationRowInput[],
  lookup: { categories: Category[]; departments: Department[] }
): Promise<AiCategorizationResult[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const expenseCategories = lookup.categories.filter((category) => category.kind === "expense" && !category.parentId && !category.archived)

  function fallbackCategorization() {
    return rows.map((row, index) => {
      const department = includesName(lookup.departments, row.description)
      const category = includesName(expenseCategories, row.description)

      return {
        categoryId: category?.id,
        categoryName: category?.name,
        confidence: category && department ? 0.72 : 0.42,
        departmentId: department?.id,
        departmentName: department?.name,
        index,
      }
    })
  }

  if (!apiKey || rows.length === 0) {
    return fallbackCategorization()
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  const client = new OpenRouter({ apiKey })

  try {
    const response = await client.chat.send({
      chatRequest: {
        model,
        messages: [
          {
            role: "system",
            content: "You categorize expense rows. Return only valid JSON array, no markdown. Use only allowed departmentName and categoryName values.",
          },
          {
            role: "user",
            content: JSON.stringify({
              allowedCategories: expenseCategories.map((category) => category.name),
              allowedDepartments: lookup.departments.map((department) => department.name),
              expectedOutput: [{ categoryName: "string", confidence: 0.82, departmentName: "string", index: 0 }],
              rows: rows.map((row, index) => ({ ...row, index })),
            }),
          },
        ],
        temperature: 0.1,
      },
    })
    const suggestions = parseJsonArray(contentToText(response.choices[0]?.message.content))

    return rows.map((_, index) => {
      const suggestion = suggestions.find((item) => item.index === index)
      const department = byName(lookup.departments, suggestion?.departmentName)
      const category = byName(expenseCategories, suggestion?.categoryName)

      return {
        categoryId: category?.id,
        categoryName: category?.name,
        confidence: Math.min(0.99, Math.max(0, suggestion?.confidence ?? 0.4)),
        departmentId: department?.id,
        departmentName: department?.name,
        index,
      }
    })
  } catch (error) {
    logOpenRouterError(error)
    return fallbackCategorization()
  }
}

export type BriefingAggregates = {
  budgetVsActual: Array<{ budgetPercent: number; department: string; expense: number }>
  departmentRollups: Array<{ contributionMarginUsd: number; department: string; expenseUsd: number; marginPercent: number; revenueUsd: number }>
  expenseByCategory: Array<{ category: string; expense: number }>
  kpis: Array<{ label: string; value: string }>
  monthlySeries: Array<{ date: string; expenseUsd: number; marginPercent: number; netProfitUsd: number; revenueUsd: number }>
  period: { from: string; to: string }
  topClients: Array<{ client: string; revenue: number }>
  totals: { expenseUsd: number; marginPercent: number; netProfitUsd: number; revenueUsd: number; rowCount: number }
}

export type ForecastProjections = {
  next12Months: Array<{ expenseUsd: number; label: string; netUsd: number; revenueUsd: number }>
  period: { from: string; to: string }
  recurringTemplates: Array<{ amountUsd: number; cadence: string; template: string; type: "revenue" | "expense" }>
  recentMonthlyAverage: { expenseUsd: number; revenueUsd: number }
}

export async function generateBriefingWithOpenRouter(
  aggregates: BriefingAggregates
): Promise<{ summary: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  const client = new OpenRouter({ apiKey: apiKey ?? "placeholder" })

  if (!apiKey) {
    return {
      summary: `Techquarters generated ${aggregates.totals.revenueUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })} in revenue and ${aggregates.totals.expenseUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })} in expenses during ${aggregates.period.from} to ${aggregates.period.to}, with a net profit of ${aggregates.totals.netProfitUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })} (${aggregates.totals.marginPercent.toFixed(0)}% margin). This summary was generated without OpenRouter because no API key is configured.`,
    }
  }

  try {
    const response = await client.chat.send({
      chatRequest: {
        model,
        messages: [
          {
            role: "system",
            content: "You write a plain-English monthly business briefing for a founder. Use the provided aggregates only. Do not invent numbers. Keep it to 3-5 sentences. Be direct and actionable.",
          },
          {
            role: "user",
            content: JSON.stringify(aggregates),
          },
        ],
        temperature: 0.3,
        maxTokens: 400,
      },
    })
    const text = contentToText(response.choices[0]?.message.content)

    return { summary: text || "Unable to generate briefing." }
  } catch (error) {
    logOpenRouterError(error)
    return { summary: "Briefing generation failed. Check OpenRouter logs for details." }
  }
}

export async function generateForecastWithOpenRouter(
  projections: ForecastProjections
): Promise<{ narrative: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  const client = new OpenRouter({ apiKey: apiKey ?? "placeholder" })

  if (!apiKey) {
    const first = projections.next12Months[0]
    const last = projections.next12Months[projections.next12Months.length - 1]
    return {
      narrative: `Based on ${projections.recurringTemplates.length} active recurring templates and a recent monthly average of ${projections.recentMonthlyAverage.revenueUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })} revenue / ${projections.recentMonthlyAverage.expenseUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })} expenses, the 12-month projection runs from ${first?.label ?? "N/A"} to ${last?.label ?? "N/A"}. This forecast was generated without OpenRouter because no API key is configured.`,
    }
  }

  try {
    const response = await client.chat.send({
      chatRequest: {
        model,
        messages: [
          {
            role: "system",
            content: "You narrate a 12-month financial forecast for a founder. Use only the provided projection data. Highlight risks, cash trajectory, and assumptions. Keep to 3-5 sentences. Be honest about uncertainty.",
          },
          {
            role: "user",
            content: JSON.stringify(projections),
          },
        ],
        temperature: 0.3,
        maxTokens: 400,
      },
    })
    const text = contentToText(response.choices[0]?.message.content)

    return { narrative: text || "Unable to generate forecast narrative." }
  } catch (error) {
    logOpenRouterError(error)
    return { narrative: "Forecast generation failed. Check OpenRouter logs for details." }
  }
}

export async function translateQuestionToFiltersWithOpenRouter(
  question: string,
  lookup: { categories: Category[]; clients: Client[]; departments: Department[] }
): Promise<AiQueryTranslationResult> {
  const fallback = heuristicFilters(question, lookup)
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return fallback

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  const client = new OpenRouter({ apiKey })

  try {
    const response = await client.chat.send({
      chatRequest: {
        model,
        messages: [
          {
            role: "system",
            content: "Translate owner finance questions into ledger filters. Return only valid JSON, no markdown. Do not invent numbers. Use only the supplied departmentName, categoryName, clientOrVendor values, and YYYY-MM-DD dates.",
          },
          {
            role: "user",
            content: JSON.stringify({
              allowedCategories: lookup.categories.filter((item) => !item.archived).map((item) => item.name),
              allowedClients: lookup.clients.map((item) => item.name),
              allowedDepartments: lookup.departments.map((item) => item.name),
              currentDate: new Date().toISOString().slice(0, 10),
              expectedOutput: {
                categoryName: "optional string",
                clientOrVendor: "optional string",
                confidence: 0.8,
                departmentName: "optional string",
                from: "YYYY-MM-DD",
                rationale: "short explanation",
                search: "optional search text",
                source: "manual|csv|automation optional",
                to: "YYYY-MM-DD",
                type: "revenue|expense optional",
              },
              question,
            }),
          },
        ],
        temperature: 0.1,
      },
    })
    const parsed = parseJsonObject(contentToText(response.choices[0]?.message.content)) as AiQueryTranslation | null
    if (!parsed) return fallback

    const department = byName(lookup.departments, parsed.departmentName)
    const category = byName(lookup.categories.filter((item) => !item.archived), parsed.categoryName)
    const matchedClient = byName(lookup.clients, parsed.clientOrVendor)
    const filters: MetricsFilter = {
      from: safeDate(parsed.from) ?? fallback.filters.from,
      to: safeDate(parsed.to) ?? fallback.filters.to,
      ...(parsed.type === "revenue" || parsed.type === "expense" ? { type: parsed.type } : {}),
      ...(department ? { departmentId: department.id } : {}),
      ...(category ? { categoryId: category.id } : {}),
      ...(matchedClient ? { clientOrVendor: matchedClient.id } : typeof parsed.clientOrVendor === "string" ? { clientOrVendor: parsed.clientOrVendor } : {}),
      ...(typeof parsed.search === "string" && parsed.search.trim() ? { search: parsed.search.trim() } : {}),
      ...(parsed.source === "manual" || parsed.source === "csv" || parsed.source === "automation" ? { source: parsed.source } : {}),
    }

    return {
      confidence: Math.min(0.99, Math.max(0.2, parsed.confidence ?? 0.7)),
      filters,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : fallback.rationale,
    }
  } catch (error) {
    logOpenRouterError(error)
    return fallback
  }
}
