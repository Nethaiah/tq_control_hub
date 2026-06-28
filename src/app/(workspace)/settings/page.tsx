import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getSettingsData } from "@/data/mock-repository"
import { SettingsWorkspace } from "@/features/settings/components/settings-workspace"
import { getOptionalAuthContext } from "@/lib/api/auth"

export const metadata: Metadata = {
  title: "Settings / Integrations | Techquarters Management Hub",
}

export default async function SettingsPage() {
  const context = await getOptionalAuthContext()

  if (!context) {
    redirect("/login")
  }

  if (!context.membership) {
    redirect("/pending-access")
  }

  if (context.membership.role !== "owner") {
    redirect("/dashboard")
  }

  const data = getSettingsData()

  return (
    <SettingsWorkspace
      settings={data.settings}
      integrations={data.integrations}
      permissionRoles={data.permissionRoles}
    />
  )
}
