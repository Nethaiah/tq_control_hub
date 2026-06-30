import type { Metadata } from "next"

import { QuerySuspenseBoundary } from "@/components/common/suspense-boundary"
import { DashboardWorkspace } from "@/features/dashboard/components/dashboard-workspace"
import DashboardLoading from "./loading"

export const metadata: Metadata = {
  title: "Dashboard | Techquarters Management Hub",
}

export default function DashboardPage() {
  return (
    <QuerySuspenseBoundary
      fallback={<DashboardLoading />}
      title="Dashboard could not load"
      description="Retry the ledger-backed cockpit view."
    >
      <DashboardWorkspace />
    </QuerySuspenseBoundary>
  )
}
