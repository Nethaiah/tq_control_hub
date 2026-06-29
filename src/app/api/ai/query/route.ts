import { z } from "zod"

import { translateQuestionToFiltersWithOpenRouter } from "@/lib/ai/openrouter"
import { requireAuthContext } from "@/lib/api/auth"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, created } from "@/lib/api/responses"
import { parseBody } from "@/lib/api/validation"
import { createAiSuggestion } from "@/lib/db/mutations/ai"
import {
  filtersToQueryString,
  getAiLedgerDateCoverage,
  loadAiQueryLookups,
  runAiLedgerQuery,
  type AiLedgerQueryResult,
} from "@/lib/db/queries/ai"

const querySchema = z.object({
  question: z.string().trim().min(8),
})

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value)
}

function periodLabel(filters: { from?: string; to?: string }) {
  if (filters.from && filters.to) return `${filters.from} to ${filters.to}`
  if (filters.from) return `from ${filters.from}`
  if (filters.to) return `through ${filters.to}`
  return "the available ledger period"
}

function buildLedgerAnswer({
  coverage,
  filters,
  question,
  result,
}: {
  coverage: { from: string | null; to: string | null }
  filters: { from?: string; to?: string; type?: "revenue" | "expense" }
  question: string
  result: AiLedgerQueryResult
}) {
  if (result.totals.rowCount === 0) {
    const coverageText = coverage.from && coverage.to
      ? `The ledger currently has source rows from ${coverage.from} to ${coverage.to}.`
      : "There are no active ledger rows available for this organization yet."

    return `I could not calculate "${question}" because no ledger rows matched ${periodLabel(filters)}. ${coverageText} No number was inferred outside the ledger.`
  }

  const mainTotal = filters.type === "revenue"
    ? result.totals.revenueUsd
    : filters.type === "expense"
      ? result.totals.expenseUsd
      : result.totals.netProfitUsd
  const metricLabel = filters.type === "revenue" ? "revenue" : filters.type === "expense" ? "expense" : "net profit"
  const topCategory = result.breakdown[0]

  return `For ${periodLabel(filters)}, matched ledger rows show ${formatUsd(mainTotal)} in ${metricLabel} across ${result.totals.rowCount} source row${result.totals.rowCount === 1 ? "" : "s"}. Revenue was ${formatUsd(result.totals.revenueUsd)}, expenses were ${formatUsd(result.totals.expenseUsd)}, and net profit was ${formatUsd(result.totals.netProfitUsd)}.${topCategory ? ` The largest source category was ${topCategory.category} at ${formatUsd(topCategory.amount)}.` : ""}`
}

function comparisonFiltersForQuestion(
  question: string,
  baseFilters: { from?: string; to?: string },
  lookups: Awaited<ReturnType<typeof loadAiQueryLookups>>
) {
  const text = question.toLowerCase()
  const asksComparison = text.includes(" vs ") || text.includes(" versus ") || text.includes(" against ")
  const asksMarketingSpend = text.includes("marketing") && (text.includes("spend") || text.includes("expense") || text.includes("cost"))
  const asksRevenue = text.includes("revenue") || text.includes("sales") || text.includes("income")

  if (!asksComparison || !asksMarketingSpend || !asksRevenue) return null

  const marketingDepartment = lookups.departments.find((department) => department.name.toLowerCase().includes("marketing"))
  const marketingCategory = lookups.categories.find((category) =>
    category.kind === "expense" && category.name.toLowerCase().includes("marketing")
  )

  return {
    left: {
      filters: {
        ...baseFilters,
        type: "expense" as const,
        ...(marketingDepartment ? { departmentId: marketingDepartment.id } : {}),
        ...(marketingDepartment ? {} : marketingCategory ? { categoryId: marketingCategory.id } : {}),
      },
      label: "marketing spend",
    },
    right: {
      filters: {
        ...baseFilters,
        type: "revenue" as const,
      },
      label: "new revenue",
    },
  }
}

function buildComparisonAnswer({
  coverage,
  left,
  question,
  right,
}: {
  coverage: { from: string | null; to: string | null }
  left: { label: string; result: AiLedgerQueryResult }
  question: string
  right: { label: string; result: AiLedgerQueryResult }
}) {
  const leftAmount = left.result.totals.expenseUsd
  const rightAmount = right.result.totals.revenueUsd
  const ratio = rightAmount > 0 ? leftAmount / rightAmount : null
  const coverageText = coverage.from && coverage.to ? ` Ledger coverage is ${coverage.from} to ${coverage.to}.` : ""

  if (left.result.totals.rowCount === 0 && right.result.totals.rowCount === 0) {
    return `I could not calculate "${question}" because neither side matched any ledger rows for the requested period.${coverageText} No number was inferred outside the ledger.`
  }

  return `${left.label} was ${formatUsd(leftAmount)} from ${left.result.totals.rowCount} source row${left.result.totals.rowCount === 1 ? "" : "s"}. ${right.label} was ${formatUsd(rightAmount)} from ${right.result.totals.rowCount} source row${right.result.totals.rowCount === 1 ? "" : "s"}. ${ratio === null ? "A spend-to-revenue ratio could not be calculated because revenue was zero." : `That is a spend-to-revenue ratio of ${(ratio * 100).toFixed(1)}%.`} All figures come from the linked ledger rows only.`
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const body = parseBody(querySchema, await request.json().catch(() => ({})))
    const lookups = await loadAiQueryLookups(context)
    const translation = await translateQuestionToFiltersWithOpenRouter(body.question, lookups)
    const coverage = await getAiLedgerDateCoverage(context)
    const comparison = comparisonFiltersForQuestion(body.question, translation.filters, lookups)
    const result = await runAiLedgerQuery(context, translation.filters)
    const comparisonResult = comparison
      ? {
          left: {
            ...comparison.left,
            filterQuery: filtersToQueryString(comparison.left.filters),
            result: await runAiLedgerQuery(context, comparison.left.filters),
          },
          right: {
            ...comparison.right,
            filterQuery: filtersToQueryString(comparison.right.filters),
            result: await runAiLedgerQuery(context, comparison.right.filters),
          },
        }
      : null
    const transactionIds = comparisonResult
      ? Array.from(new Set([
          ...comparisonResult.left.result.totals.transactionIds,
          ...comparisonResult.right.result.totals.transactionIds,
        ]))
      : result.totals.transactionIds
    const filterQuery = filtersToQueryString(translation.filters, transactionIds)
    const answer = comparisonResult
      ? buildComparisonAnswer({
          coverage,
          left: { label: comparisonResult.left.label, result: comparisonResult.left.result },
          question: body.question,
          right: { label: comparisonResult.right.label, result: comparisonResult.right.result },
        })
      : buildLedgerAnswer({ coverage, filters: translation.filters, question: body.question, result })
    const suggestion = await createAiSuggestion(context, {
      confidence: translation.confidence,
      feature: "natural_language_query",
      filterQuery,
      proposedAction: translation.rationale,
      reviewState: "draft",
      summary: answer,
      title: body.question,
      transactionIds,
    })

    return created({
      answer,
      breakdown: result.breakdown,
      comparison: comparisonResult
        ? {
            left: {
              breakdown: comparisonResult.left.result.breakdown,
              filterQuery: comparisonResult.left.filterQuery,
              label: comparisonResult.left.label,
              sourceRows: comparisonResult.left.result.sourceRows,
              totals: comparisonResult.left.result.totals,
            },
            right: {
              breakdown: comparisonResult.right.result.breakdown,
              filterQuery: comparisonResult.right.filterQuery,
              label: comparisonResult.right.label,
              sourceRows: comparisonResult.right.result.sourceRows,
              totals: comparisonResult.right.result.totals,
            },
          }
        : null,
      filterQuery,
      filters: translation.filters,
      sourceRows: comparisonResult
        ? [...comparisonResult.left.result.sourceRows, ...comparisonResult.right.result.sourceRows]
        : result.sourceRows,
      suggestion,
      totals: result.totals,
    })
  } catch (error) {
    return apiError(error)
  }
}
