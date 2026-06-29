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
  const [draftFrom, setDraftFrom] = React.useState(filters.from ?? "")
  const [draftTo, setDraftTo] = React.useState(filters.to ?? "")

  React.useEffect(() => {
    if (open) {
      setDraftFrom(filters.from ?? "")
      setDraftTo(filters.to ?? "")
    }
  }, [open, filters.from, filters.to])

  function save() {
    setFilters({ from: draftFrom || undefined, to: draftTo || undefined, ids: undefined })
    setOpen(false)
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
                value={draftFrom}
                onChange={(value) => setDraftFrom(value ?? "")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dashboard-to">To</FieldLabel>
              <DatePicker
                value={draftTo}
                onChange={(value) => setDraftTo(value ?? "")}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraftFrom(DEFAULT_MONTH_FILTERS.from ?? "")
                setDraftTo(DEFAULT_MONTH_FILTERS.to ?? "")
              }}
            >
              <CalendarDaysIcon data-icon="inline-start" />
              June view
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraftFrom("2026-04-01")
                setDraftTo("2026-07-31")
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              All seeded dates
            </Button>
          </div>
          <Button onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
