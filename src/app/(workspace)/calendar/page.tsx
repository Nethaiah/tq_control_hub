import type { Metadata } from "next"

import { CalendarWorkspace } from "@/features/calendar/components/calendar-workspace"

export const metadata: Metadata = {
  title: "Financial Calendar | Techquarters Management Hub",
}

export default function CalendarPage() {
  return <CalendarWorkspace />
}