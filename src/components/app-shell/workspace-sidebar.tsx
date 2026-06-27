"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BrainCircuitIcon,
  Building2Icon,
  CalendarDaysIcon,
  FileSpreadsheetIcon,
  ImportIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  UsersIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const primaryNavigation = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Ledger", href: "/ledger", icon: FileSpreadsheetIcon },
  { title: "Departments", href: "/departments", icon: Building2Icon },
  { title: "Categories", href: "/categories", icon: SlidersHorizontalIcon },
  { title: "CSV Import", href: "/imports", icon: ImportIcon },
  { title: "AI Insights", href: "/insights", icon: BrainCircuitIcon },
  { title: "People", href: "/people", icon: UsersIcon },
  { title: "Calendar", href: "/calendar", icon: CalendarDaysIcon },
  { title: "Settings", href: "/settings", icon: Settings2Icon },
]

export function WorkspaceSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                TQ
              </div>
              <div className="grid leading-tight">
                <span className="text-sm font-semibold">Techquarters</span>
                <span className="text-xs text-muted-foreground">Management Hub</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Owner cockpit</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNavigation.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="rounded-lg border bg-sidebar-accent p-3 text-xs">
          <div className="font-medium">Owner mode</div>
          <div className="mt-1 text-muted-foreground">
            Ledger-backed decisions. AI drafts only.
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
