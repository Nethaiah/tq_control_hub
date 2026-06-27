import type { Metadata } from "next"

import { getWorkspaceData } from "@/data/mock-repository"
import { CsvImportReview } from "@/features/imports/components/csv-import-review"

export const metadata: Metadata = {
  title: "CSV Import Review | Techquarters Management Hub",
}

export default function ImportsPage() {
  const data = getWorkspaceData()

  return (
    <CsvImportReview
      imports={data.csvImports}
      rows={data.csvStagedRows}
      departments={data.departments}
      categories={data.categories}
    />
  )
}
