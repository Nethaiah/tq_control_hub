import { generateBriefingWithOpenRouter } from "@/lib/ai/openrouter"
import { requireAuthContext } from "@/lib/api/auth"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, created } from "@/lib/api/responses"
import { createAiSuggestion } from "@/lib/db/mutations/ai"
import { getDashboardMetrics } from "@/lib/db/queries/metrics"

export async function POST() {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const now = new Date()
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10)
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10)

    const metrics = await getDashboardMetrics(context, { from, to })
    const aggregates = {
      budgetVsActual: metrics.budgetVsActual.map((item) => ({
        budgetPercent: item.budget === 0 ? 0 : Math.round((item.actual / item.budget) * 100),
        department: item.department,
        expense: item.actual,
      })),
      departmentRollups: metrics.departmentRollups.map((item) => ({
        contributionMarginUsd: item.contributionMarginUsd,
        department: item.department.name,
        expenseUsd: item.expenseUsd,
        marginPercent: item.marginPercent,
        revenueUsd: item.revenueUsd,
      })),
      expenseByCategory: metrics.expenseByCategory.map((item) => ({
        category: item.category,
        expense: item.expense,
      })),
      kpis: metrics.kpis.map((kpi) => ({
        label: kpi.label,
        value: kpi.value,
      })),
      monthlySeries: metrics.monthlySeries.map((item) => ({
        date: item.label,
        expenseUsd: item.expenses,
        marginPercent: item.marginPercent,
        netProfitUsd: item.netProfit,
        revenueUsd: item.revenue,
      })),
      period: { from, to },
      topClients: metrics.topClients.map((item) => ({
        client: item.client,
        revenue: item.revenue,
      })),
      totals: {
        expenseUsd: metrics.totals.expenseUsd,
        marginPercent: metrics.totals.marginPercent,
        netProfitUsd: metrics.totals.netProfitUsd,
        revenueUsd: metrics.totals.revenueUsd,
        rowCount: metrics.totals.rowCount,
      },
    }

    const { summary } = await generateBriefingWithOpenRouter(aggregates)

    const suggestion = await createAiSuggestion(context, {
      confidence: 0.75,
      feature: "briefing",
      proposedAction: `Review the monthly summary and trace any claims to ledger rows via the dashboard. Period: ${from} to ${to}.`,
      reviewState: "draft",
      summary,
      title: `Monthly briefing (${from} to ${to})`,
      transactionIds: [],
    })

    return created({ aggregates, suggestion })
  } catch (error) {
    return apiError(error)
  }
}
