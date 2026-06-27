import type { Metadata } from "next"

import { getCalendarData } from "@/data/mock-repository"
import { FinancialCalendar } from "@/features/calendar/components/financial-calendar"

export const metadata: Metadata = {
  title: "Financial Calendar | Techquarters Management Hub",
}

export default function CalendarPage() {
  const data = getCalendarData()

  return <FinancialCalendar metrics={data.metrics} />
}
