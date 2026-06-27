import type { Metadata } from "next"

import { getSettingsData } from "@/data/mock-repository"
import { SettingsWorkspace } from "@/features/settings/components/settings-workspace"

export const metadata: Metadata = {
  title: "Settings / Integrations | Techquarters Management Hub",
}

export default function SettingsPage() {
  const data = getSettingsData()

  return (
    <SettingsWorkspace
      settings={data.settings}
      integrations={data.integrations}
      permissionRoles={data.permissionRoles}
    />
  )
}
