import type { Metadata } from "next"

import { CsvImportReview } from "@/features/imports/components/csv-import-review"

export const metadata: Metadata = {
  title: "CSV Import Review | Techquarters Management Hub",
}

export default function ImportsPage() {
  return <CsvImportReview />
}
