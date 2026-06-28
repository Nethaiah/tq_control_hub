import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { SignupForm } from "./signup-form"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Accounts need organization access before entering the hub.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm error={params.error} />
      </CardContent>
    </Card>
  )
}
