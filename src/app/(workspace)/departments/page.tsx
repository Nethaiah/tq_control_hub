import type { Metadata } from "next"

import { QuerySuspenseBoundary } from "@/components/common/suspense-boundary"
import { DepartmentsWorkspace } from "@/features/departments/components/departments-workspace"
import DepartmentsLoading from "./loading"

export const metadata: Metadata = {
  title: "Departments | Techquarters Management Hub",
}

export default function DepartmentsPage() {
  return (
    <QuerySuspenseBoundary
      fallback={<DepartmentsLoading />}
      title="Departments could not load"
      description="Retry the department P&L view."
    >
      <DepartmentsWorkspace />
    </QuerySuspenseBoundary>
  )
}
