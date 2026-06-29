import type { Metadata } from "next"

import { DepartmentsWorkspace } from "@/features/departments/components/departments-workspace"

export const metadata: Metadata = {
  title: "Departments | Techquarters Management Hub",
}

export default function DepartmentsPage() {
  return <DepartmentsWorkspace />
}