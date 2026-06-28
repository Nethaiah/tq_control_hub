import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10">
      {children}
    </main>
  )
}
