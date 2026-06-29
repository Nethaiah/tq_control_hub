import { generateForecastWithOpenRouter } from "@/lib/ai/openrouter"
import { requireAuthContext } from "@/lib/api/auth"
import { DEFAULT_MONTH_FILTERS } from "@/domain/filters"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, created } from "@/lib/api/responses"
import { createAiSuggestion } from "@/lib/db/mutations/ai"
import { getDashboardMetrics } from "@/lib/db/queries/metrics"
import { listRecurringItemsData } from "@/lib/db/queries/recurring-items"

function addMonths(dateStr: string, months: number) {
  const date = new Date(dateStr)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

function monthLabel(monthsFromNow: number) {
  const now = new Date()
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsFromNow, 1))
  return target.toISOString().slice(0, 7)
}

export async function POST() {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const now = new Date()
    const currentFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10)
    const currentTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10)

    const [metrics, recurringData] = await Promise.all([
      getDashboardMetrics(context, { from: currentFrom, to: currentTo }),
      listRecurringItemsData(context, { page: 1, pageSize: 200 }),
    ])

    const recurringTemplates = recurringData.recurringItems.map((item) => {
      const fxRate = item.currency === "AED" ? 0.2723 : 1
      return {
        amountUsd: item.amount * fxRate,
        cadence: item.cadence,
        template: item.template,
        type: item.type,
      }
    })

    const recentMonthlyAverage = {
      expenseUsd: metrics.totals.expenseUsd,
      revenueUsd: metrics.totals.revenueUsd,
    }

    const next12Months: Array<{
      expenseUsd: number
      label: string
      netUsd: number
      revenueUsd: number
    }> = []

    for (let i = 0; i < 12; i++) {
      const monthStart = monthLabel(i + 1)
      let monthRevenue = 0
      let monthExpense = 0

      for (const template of recurringTemplates) {
        const monthlyAmount =
          template.cadence === "annual"
            ? template.amountUsd / 12
            : template.cadence === "quarterly"
              ? template.amountUsd / 3
              : template.amountUsd

        if (template.type === "revenue") {
          monthRevenue += monthlyAmount
        } else {
          monthExpense += monthlyAmount
        }
      }

      const blendedRevenue = (recentMonthlyAverage.revenueUsd + monthRevenue) / 2
      const blendedExpense = (recentMonthlyAverage.expenseUsd + monthExpense) / 2

      next12Months.push({
        expenseUsd: Math.round(blendedExpense),
        label: monthStart,
        netUsd: Math.round(blendedRevenue - blendedExpense),
        revenueUsd: Math.round(blendedRevenue),
      })
    }

    const projections = {
      next12Months,
      period: { from: currentFrom, to: currentTo },
      recurringTemplates,
      recentMonthlyAverage,
    }

    const { narrative } = await generateForecastWithOpenRouter(projections)

    const first = next12Months[0]
    const last = next12Months[next12Months.length - 1]
    const summary = `${narrative}\n\nProjection range: ${first.label} to ${last.label}. Based on ${recurringTemplates.length} recurring templates and current month data.`

    const suggestion = await createAiSuggestion(context, {
      confidence: 0.6,
      feature: "forecast",
      proposedAction: "Review assumptions. Recurring templates drive projections. This is not booked revenue.",
      reviewState: "draft",
      summary,
      title: `12-month forecast from ${first.label}`,
      transactionIds: [],
    })

    return created({ projections, suggestion })
  } catch (error) {
    return apiError(error)
  }
}
