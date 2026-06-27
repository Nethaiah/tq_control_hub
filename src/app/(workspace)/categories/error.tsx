"use client"

import { Button } from "@/components/ui/button"

export default function CategoriesError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-xl font-semibold">Category settings could not load</h2>
      <p className="text-sm text-muted-foreground">Retry the category configuration view.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  )
}
