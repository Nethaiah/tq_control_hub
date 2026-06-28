import { redirect } from "next/navigation"

import { getOptionalAuthContext } from "@/lib/api/auth"

export default async function HomePage() {
  const context = await getOptionalAuthContext()

  if (!context) {
    redirect("/login")
  }

  if (!context.membership) {
    redirect("/pending-access")
  }

  redirect("/dashboard")
}
