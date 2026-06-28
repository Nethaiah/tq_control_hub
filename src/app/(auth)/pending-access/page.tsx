import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getOptionalAuthContext } from "@/lib/api/auth"

import { logoutAction } from "../actions"

export default async function PendingAccessPage() {
  const context = await getOptionalAuthContext()

  if (!context) {
    redirect("/login")
  }

  if (context.membership) {
    redirect("/dashboard")
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Access pending</CardTitle>
        <CardDescription>Your account exists, but it is not linked to Techquarters yet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 text-xs">
          <div className="font-medium">Signed in as</div>
          <div className="mt-1 text-muted-foreground">{context.user.email}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ask an owner to add this email to the organization. Signup does not automatically grant access.
        </p>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
