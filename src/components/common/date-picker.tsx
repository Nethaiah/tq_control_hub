"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import * as React from "react"
import type { ChangeEvent, ChangeEventHandler } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type DatePickerProps = {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return isNaN(date.getTime()) ? undefined : date
}

function formatDateForValue(date: Date | undefined): string {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
}: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(() => parseDate(value))
  const [month, setMonth] = React.useState<Date>(() => parseDate(value) ?? new Date())

  React.useEffect(() => {
    const parsed = parseDate(value)
    setDate(parsed)
    if (parsed) setMonth(parsed)
  }, [value])

  const handleCalendarChange = (
    val: string | number,
    event: ChangeEventHandler<HTMLSelectElement>
  ) => {
    const newEvent = {
      target: {
        value: String(val),
      },
    } as ChangeEvent<HTMLSelectElement>
    event(newEvent)
  }

  const handleSelect = (newDate: Date | undefined) => {
    setDate(newDate)
    if (newDate) {
      onChange?.(formatDateForValue(newDate))
    } else {
      onChange?.("")
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className
            )}
            variant="outline"
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 size-4" />
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          captionLayout="dropdown"
          components={{
            MonthCaption: (props) => <>{props.children}</>,
            DropdownNav: (props) => (
              <div className="flex w-full items-center gap-2">
                {props.children}
              </div>
            ),
            Dropdown: (props) => (
              <Select
                onValueChange={(val) => {
                  if (val && props.onChange) {
                    handleCalendarChange(val, props.onChange)
                  }
                }}
                value={String(props.value)}
              >
                <SelectTrigger className="first:flex-1 last:shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {props.options?.map((option) => (
                    <SelectItem
                      disabled={option.disabled}
                      key={option.value}
                      value={String(option.value)}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ),
          }}
          hideNavigation
          mode="single"
          month={month}
          onMonthChange={setMonth}
          onSelect={handleSelect}
          selected={date}
        />
      </PopoverContent>
    </Popover>
  )
}
