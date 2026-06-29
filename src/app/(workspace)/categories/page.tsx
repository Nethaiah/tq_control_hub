import type { Metadata } from "next"

import { CategorySettings } from "@/features/categories/components/category-settings"

export const metadata: Metadata = {
  title: "Category Settings | Techquarters Management Hub",
}

export default function CategoriesPage() {
  return <CategorySettings />
}
