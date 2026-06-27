import type { Metadata } from "next"

import { getPeopleData } from "@/data/mock-repository"
import { PeopleOverview } from "@/features/people/components/people-overview"

export const metadata: Metadata = {
  title: "People / Team | Techquarters Management Hub",
}

export default function PeoplePage() {
  const data = getPeopleData()

  return (
    <PeopleOverview
      people={data.people}
      departments={data.departments}
      transactions={data.transactions}
      metrics={data.metrics}
    />
  )
}
