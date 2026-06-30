import type { Metadata } from "next"

import { QuerySuspenseBoundary } from "@/components/common/suspense-boundary"
import { CsvImportReview } from "@/features/imports/components/csv-import-review"
import ImportsLoading from "./loading"

export const metadata: Metadata = {
  title: "CSV Import Review | Techquarters Management Hub",
}

export default function ImportsPage() {
  return (
    <QuerySuspenseBoundary
      fallback={<ImportsLoading />}
      title="CSV import review could not load"
      description="Retry loading imports and staged rows."
    >
      <CsvImportReview />
    </QuerySuspenseBoundary>
  )
}
