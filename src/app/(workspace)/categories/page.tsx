import type { Metadata } from "next"

import { getWorkspaceData } from "@/data/mock-repository"
import { CategorySettings } from "@/features/categories/components/category-settings"

export const metadata: Metadata = {
  title: "Category Settings | Techquarters Management Hub",
}

export default function CategoriesPage() {
  const data = getWorkspaceData()

  return <CategorySettings categories={data.categories} recurringItems={data.recurringItems} />
}
