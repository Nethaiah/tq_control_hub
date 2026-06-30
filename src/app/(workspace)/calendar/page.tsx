import type { Metadata } from "next"

import { QuerySuspenseBoundary } from "@/components/common/suspense-boundary"
import { CalendarWorkspace } from "@/features/calendar/components/calendar-workspace"
import CalendarLoading from "./loading"

export const metadata: Metadata = {
  title: "Financial Calendar | Techquarters Management Hub",
}

export default function CalendarPage() {
  return (
    <QuerySuspenseBoundary
      fallback={<CalendarLoading />}
      title="Financial calendar could not load"
      description="Retry loading calendar metrics."
    >
      <CalendarWorkspace />
    </QuerySuspenseBoundary>
  )
}
