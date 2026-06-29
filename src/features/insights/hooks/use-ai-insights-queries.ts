"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { AiSuggestion } from "@/domain/types"
import type { MetricsFilter } from "@/lib/api/filters"
import type { AiQueryBreakdownRow } from "@/lib/db/queries/ai"

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } }

export type AiQueryResult = {
  answer: string
  breakdown: AiQueryBreakdownRow[]
  comparison: {
    left: AiQueryComparisonSide
    right: AiQueryComparisonSide
  } | null
  filterQuery: string
  filters: MetricsFilter
  suggestion: AiSuggestion
  sourceRows: AiQuerySourceRow[]
  totals: {
    expenseUsd: number
    netProfitUsd: number
    revenueUsd: number
    rowCount: number
    transactionIds: string[]
  }
}

export type AiQuerySourceRow = {
  amountUsd: number
  category: string | null
  clientOrVendor: string | null
  date: string
  department: string | null
  description: string
  id: string
  type: "revenue" | "expense"
}

export type AiQueryComparisonSide = {
  breakdown: AiQueryBreakdownRow[]
  filterQuery: string
  label: string
  sourceRows: AiQuerySourceRow[]
  totals: AiQueryResult["totals"]
}

async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload && !payload.ok ? payload.error.message : fallbackMessage)
  }

  return payload.data
}

export const aiSuggestionsQueryKey = ["ai-suggestions"] as const

export function useAiSuggestions() {
  return useQuery({
    queryKey: aiSuggestionsQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/ai/suggestions", { credentials: "same-origin" })
      const data = await readApiResponse<{ suggestions: AiSuggestion[] }>(response, "Unable to load AI suggestions")
      return data.suggestions
    },
  })
}

export function useRunAiQuery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (question: string) => {
      const response = await fetch("/api/ai/query", {
        body: JSON.stringify({ question }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      return readApiResponse<AiQueryResult>(response, "Unable to run AI query")
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AiSuggestion[]>(aiSuggestionsQueryKey, (current) => [
        data.suggestion,
        ...(current?.filter((item) => item.id !== data.suggestion.id) ?? []),
      ])
    },
  })
}

export function useUpdateAiSuggestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; reviewState: AiSuggestion["reviewState"] }) => {
      const response = await fetch(`/api/ai/suggestions/${encodeURIComponent(input.id)}`, {
        body: JSON.stringify({ reviewState: input.reviewState }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      })

      return readApiResponse<{ suggestion: AiSuggestion }>(response, "Unable to update AI suggestion")
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AiSuggestion[]>(aiSuggestionsQueryKey, (current) =>
        current?.map((item) => item.id === data.suggestion.id ? data.suggestion : item) ?? [data.suggestion]
      )
    },
  })
}
