"use client"

import * as React from "react"
import { CalendarDaysIcon, CalendarIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { DEFAULT_MONTH_FILTERS } from "@/domain/filters"
import { useUrlFilters } from "@/hooks/use-url-filters"

import { DatePicker } from "./date-picker"

export function DateRangeControls() {
  const { filters, setFilters } = useUrlFilters()
  const [open, setOpen] = React.useState(false)

  function apply(patch: Parameters<typeof setFilters>[0]) {
    setFilters(patch)
  }

  const label = filters.from && filters.to
    ? `${filters.from} → ${filters.to}`
    : filters.from
      ? `From ${filters.from}`
      : filters.to
        ? `To ${filters.to}`
        : "Date range"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <CalendarIcon data-icon="inline-start" />
            {label}
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Date range</DialogTitle>
          <DialogDescription>Choose the global reporting window.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="dashboard-from">From</FieldLabel>
              <DatePicker
                value={filters.from ?? ""}
                onChange={(value) => apply({ from: value || undefined, ids: undefined })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dashboard-to">To</FieldLabel>
              <DatePicker
                value={filters.to ?? ""}
                onChange={(value) => apply({ to: value || undefined, ids: undefined })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => apply({ ...DEFAULT_MONTH_FILTERS, ids: undefined })}
            >
              <CalendarDaysIcon data-icon="inline-start" />
              June view
            </Button>
            <Button
              variant="ghost"
              onClick={() => apply({ from: "2026-04-01", to: "2026-07-31", ids: undefined })}
            >
              <RotateCcwIcon data-icon="inline-start" />
              All seeded dates
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
