"use client"

import Link from "next/link"
import * as React from "react"

import {
  CalendarBody,
  CalendarDate,
  CalendarDatePagination,
  CalendarHeader,
  CalendarItem,
  CalendarMonthPicker,
  CalendarProvider,
  CalendarYearPicker,
  useCalendarMonth,
  useCalendarYear,
  type Feature,
} from "@/components/kibo-ui/calendar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { buildLedgerHref } from "@/domain/filters"
import type { CalendarEvent } from "@/domain/types"
import { formatCurrency } from "@/domain/currency"
import { titleCase } from "@/lib/format"
import { cn } from "@/lib/utils"

const eventStatuses = {
  payroll: { id: "payroll", name: "Payroll", color: "var(--destructive)" },
  retainer: { id: "retainer", name: "Retainer", color: "var(--chart-1)" },
  invoice_due: { id: "invoice_due", name: "Invoice due", color: "var(--chart-4)" },
  renewal: { id: "renewal", name: "Renewal", color: "var(--chart-2)" },
  tax: { id: "tax", name: "Tax", color: "var(--destructive)" },
  review: { id: "review", name: "Review", color: "var(--chart-3)" },
} satisfies Record<CalendarEvent["type"], Feature["status"]>

type CalendarFeature = Feature & {
  event: CalendarEvent
}

function eventHref(event: CalendarEvent) {
  if (event.transactionId) {
    return buildLedgerHref({ ids: event.transactionId })
  }

  if (event.type === "payroll") {
    return buildLedgerHref({ type: "expense" })
  }

  if (event.type === "retainer" || event.type === "invoice_due") {
    return buildLedgerHref({ type: "revenue" })
  }

  return buildLedgerHref()
}

function CalendarStateInitializer() {
  const [, setMonth] = useCalendarMonth()
  const [, setYear] = useCalendarYear()

  React.useEffect(() => {
    setMonth(6)
    setYear(2026)
  }, [setMonth, setYear])

  return null
}

function toFeature(event: CalendarEvent): CalendarFeature {
  const eventDate = new Date(`${event.date}T12:00:00`)

  return {
    id: event.id,
    name: event.title,
    startAt: eventDate,
    endAt: eventDate,
    status: eventStatuses[event.type],
    event,
  }
}

function FinancialCalendarItem({ feature }: { feature: Feature }) {
  const calendarFeature = feature as CalendarFeature
  const event = calendarFeature.event

  return (
    <Tooltip>
      <TooltipTrigger render={<Link href={eventHref(event)} />}>
        <CalendarItem
          feature={feature}
          className={cn(
            "mb-1 max-w-full rounded-md border bg-muted/45 px-1.5 py-1 text-[0.65rem] leading-none text-foreground hover:bg-muted",
            (event.type === "payroll" || event.type === "tax") && "text-destructive"
          )}
        />
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <div className="grid gap-1">
          <div className="font-medium">{event.title}</div>
          <div>{titleCase(event.type)} · {formatCurrency(event.amountUsd)}</div>
          <div>{event.transactionId ? "Linked to ledger row" : event.recurringItemId ? "Generated from recurring template" : "Review event"}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function KiboFinancialCalendar({ events }: { events: CalendarEvent[] }) {
  const features = React.useMemo(() => events.map(toFeature), [events])

  return (
    <CalendarProvider className="overflow-hidden rounded-lg border bg-card" locale="en-US" startDay={1}>
      <CalendarStateInitializer />
      <CalendarDate className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarMonthPicker />
          <CalendarYearPicker start={2025} end={2027} />
        </div>
        <CalendarDatePagination />
      </CalendarDate>
      <CalendarHeader className="border-b" />
      <CalendarBody features={features}>
        {({ feature }) => <FinancialCalendarItem key={feature.id} feature={feature} />}
      </CalendarBody>
    </CalendarProvider>
  )
}
