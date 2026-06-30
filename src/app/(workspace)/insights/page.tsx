import type { Metadata } from "next"

import { QuerySuspenseBoundary } from "@/components/common/suspense-boundary"
import { AiInsights } from "@/features/insights/components/ai-insights"
import InsightsLoading from "./loading"

export const metadata: Metadata = {
  title: "AI Insights | Techquarters Management Hub",
}

export default function InsightsPage() {
  return (
    <QuerySuspenseBoundary
      fallback={<InsightsLoading />}
      title="AI insights could not load"
      description="Retry loading AI suggestions."
    >
      <AiInsights />
    </QuerySuspenseBoundary>
  )
}
