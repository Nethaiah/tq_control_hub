import type { Metadata } from "next"

import { QuerySuspenseBoundary } from "@/components/common/suspense-boundary"
import { CategorySettings } from "@/features/categories/components/category-settings"
import CategoriesLoading from "./loading"

export const metadata: Metadata = {
  title: "Category Settings | Techquarters Management Hub",
}

export default function CategoriesPage() {
  return (
    <QuerySuspenseBoundary
      fallback={<CategoriesLoading />}
      title="Category settings could not load"
      description="Retry loading categories and recurring templates."
    >
      <CategorySettings />
    </QuerySuspenseBoundary>
  )
}
