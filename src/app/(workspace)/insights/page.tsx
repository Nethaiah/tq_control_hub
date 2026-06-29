import type { Metadata } from "next"

import { AiInsights } from "@/features/insights/components/ai-insights"

export const metadata: Metadata = {
  title: "AI Insights | Techquarters Management Hub",
}

export default function InsightsPage() {
  return <AiInsights />
}
