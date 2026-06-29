import type { Metadata } from "next"

import { DashboardWorkspace } from "@/features/dashboard/components/dashboard-workspace"

export const metadata: Metadata = {
  title: "Dashboard | Techquarters Management Hub",
}

export default function DashboardPage() {
  return <DashboardWorkspace />
}