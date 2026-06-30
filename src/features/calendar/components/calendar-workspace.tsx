"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { parseAsString, useQueryStates } from "nuqs"

import { FinancialCalendar } from "@/features/calendar/components/financial-calendar"
import { readApiResponse } from "@/features/metrics/api-client"
import type { CalendarMetrics } from "@/domain/metrics"

const DEFAULT_START_DATE = "2026-07-01"
const DEFAULT_END_DATE = "2026-07-30"

const windowParsers = {
  endDate: parseAsString.withDefault(DEFAULT_END_DATE),
  startDate: parseAsString.withDefault(DEFAULT_START_DATE),
}

async function fetchCalendarMetrics(startDate: string, endDate: string) {
  const params = new URLSearchParams()
  if (startDate) params.set("startDate", startDate)
  if (endDate) params.set("endDate", endDate)
  const query = params.toString()
  const response = await fetch(`/api/metrics/calendar${query ? `?${query}` : ""}`, {
    credentials: "same-origin",
  })
  return readApiResponse<CalendarMetrics>(response, "Unable to load calendar metrics")
}

export function CalendarWorkspace() {
  const [window] = useQueryStates(windowParsers)
  const query = useSuspenseQuery({
    queryFn: () => fetchCalendarMetrics(window.startDate, window.endDate),
    queryKey: ["metrics", "calendar", window.startDate, window.endDate],
    staleTime: 60_000,
  })

  return <FinancialCalendar metrics={query.data} />
}
