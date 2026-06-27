import { Suspense, type ReactNode } from "react"

import { WorkspaceHeader } from "@/components/app-shell/workspace-header"
import { WorkspaceSidebar } from "@/components/app-shell/workspace-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
          "--header-height": "calc(var(--spacing) * 16)",
        } as React.CSSProperties
      }
    >
      <WorkspaceSidebar variant="inset" />
      <SidebarInset>
        <Suspense fallback={<div className="min-h-(--header-height) border-b bg-background" />}>
          <WorkspaceHeader />
        </Suspense>
        <main className="flex min-w-0 flex-1 flex-col bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
