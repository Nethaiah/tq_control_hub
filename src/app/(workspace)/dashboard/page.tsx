import type { Metadata } from "next"

import { getDashboardData } from "@/data/mock-repository"
import { filtersFromSearchParams } from "@/domain/filters"
import { OwnerDashboard } from "@/features/dashboard/components/owner-dashboard"

export const metadata: Metadata = {
  title: "Dashboard | Techquarters Management Hub",
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const filters = filtersFromSearchParams(await searchParams)
  const metrics = getDashboardData(filters)

  return <OwnerDashboard metrics={metrics} />
}
