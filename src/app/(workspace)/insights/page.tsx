import type { Metadata } from "next"

import { getAiQueryBreakdown, getWorkspaceData } from "@/data/mock-repository"
import { AiInsights } from "@/features/insights/components/ai-insights"

export const metadata: Metadata = {
  title: "AI Insights | Techquarters Management Hub",
}

export default function InsightsPage() {
  const data = getWorkspaceData()
  const queryBreakdown = getAiQueryBreakdown({
    from: "2026-06-01",
    to: "2026-06-30",
    type: "expense",
    departmentId: "dept_development",
  })

  return <AiInsights suggestions={data.aiSuggestions} queryBreakdown={queryBreakdown} />
}
