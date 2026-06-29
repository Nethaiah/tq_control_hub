import type { Metadata } from "next"

import { PeopleWorkspace } from "@/features/people/components/people-workspace"

export const metadata: Metadata = {
  title: "People / Team | Techquarters Management Hub",
}

export default function PeoplePage() {
  return <PeopleWorkspace />
}