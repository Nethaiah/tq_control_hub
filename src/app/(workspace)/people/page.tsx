import type { Metadata } from "next"

import { QuerySuspenseBoundary } from "@/components/common/suspense-boundary"
import { PeopleWorkspace } from "@/features/people/components/people-workspace"
import PeopleLoading from "./loading"

export const metadata: Metadata = {
  title: "People / Team | Techquarters Management Hub",
}

export default function PeoplePage() {
  return (
    <QuerySuspenseBoundary
      fallback={<PeopleLoading />}
      title="People could not load"
      description="Retry loading people metrics and team records."
    >
      <PeopleWorkspace />
    </QuerySuspenseBoundary>
  )
}
