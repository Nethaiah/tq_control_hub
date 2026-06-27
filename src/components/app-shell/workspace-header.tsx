"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BotIcon, FileUpIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { activeFilterCount, filtersFromSearchParams } from "@/domain/filters"

export function WorkspaceHeader() {
  const searchParams = useSearchParams()
  const filters = filtersFromSearchParams(Object.fromEntries(searchParams.entries()))
  const count = activeFilterCount(filters)

  return (
    <header className="sticky top-0 z-20 flex min-h-(--header-height) shrink-0 items-center border-b bg-background/95 backdrop-blur">
      <div className="flex w-full flex-col gap-3 px-4 py-3 lg:px-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Are we okay, and what do I do this week?</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Reporting USD</span>
              <span>Operating AED</span>
              <span>June 2026</span>
              <span>Last import: needs review</span>
              <span>{count} active filters</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant="outline" render={<Link href="/ledger?add=transaction" />}>
            <PlusIcon data-icon="inline-start" />
            Add transaction
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="/imports" />}>
            <FileUpIcon data-icon="inline-start" />
            Import CSV
          </Button>
          <Button nativeButton={false} render={<Link href="/insights" />}>
            <BotIcon data-icon="inline-start" />
            Ask AI
          </Button>
        </div>
      </div>
    </header>
  )
}
