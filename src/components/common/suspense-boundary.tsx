"use client"

import * as React from "react"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { AlertTriangleIcon } from "lucide-react"

import { PageHeader, PageShell } from "@/components/common/page-shell"
import { Button } from "@/components/ui/button"

type ErrorFallbackProps = {
  error: Error
  reset: () => void
}

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback: (props: ErrorFallbackProps) => React.ReactNode
  onReset?: () => void
}

type ErrorBoundaryState = {
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset })
    }

    return this.props.children
  }
}

function DefaultErrorFallback({
  description,
  error,
  reset,
  title,
}: ErrorFallbackProps & {
  description: string
  title: string
}) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        <div className="grid gap-3">
          <div>{error.message || "Unable to load this data."}</div>
          <Button variant="outline" size="sm" className="w-fit" onClick={reset}>
            Retry
          </Button>
        </div>
      </div>
    </PageShell>
  )
}

function BlockErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-3">
        <div>{error.message || "Unable to load this data."}</div>
        <Button variant="outline" size="sm" className="w-fit" onClick={reset}>
          Retry
        </Button>
      </div>
    </div>
  )
}

export function QuerySuspenseBoundary({
  children,
  description = "Retry loading this view.",
  errorVariant = "page",
  errorFallback,
  fallback,
  title = "View could not load",
}: {
  children: React.ReactNode
  description?: string
  errorVariant?: "page" | "block"
  errorFallback?: (props: ErrorFallbackProps) => React.ReactNode
  fallback: React.ReactNode
  title?: string
}) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return fallback
  }

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallback={(props) =>
            errorFallback ? (
              errorFallback(props)
            ) : errorVariant === "block" ? (
              <BlockErrorFallback {...props} />
            ) : (
              <DefaultErrorFallback {...props} title={title} description={description} />
            )
          }
        >
          <React.Suspense fallback={fallback}>{children}</React.Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
