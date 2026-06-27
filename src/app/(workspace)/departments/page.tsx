import type { Metadata } from "next"

import { getDepartmentData } from "@/data/mock-repository"
import { filtersFromSearchParams } from "@/domain/filters"
import { DepartmentsOverview } from "@/features/departments/components/departments-overview"

export const metadata: Metadata = {
  title: "Departments | Techquarters Management Hub",
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DepartmentsPage({ searchParams }: PageProps) {
  const filters = filtersFromSearchParams(await searchParams)
  const data = getDepartmentData(filters)

  return <DepartmentsOverview rollups={data.rollups} />
}
