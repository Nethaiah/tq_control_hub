"use client"

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"

import type { AiSuggestion, Category, Client, Department, ManualTransactionFormValues, Transaction } from "@/domain/types"
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

export type OcrDraftResult = {
  draft: {
    amount: number | null
    categoryId: string | null
    categoryName: string | null
    currency: "AED" | "USD" | null
    date: string | null
    departmentId: string | null
    departmentName: string | null
    description: string
    lineItems?: string[]
    vendor: string | null
  }
  parse: {
    confidence: number
    fileId: string | null
    jobId: string | null
    pageCount: number
    provider: string
    tier: string
  }
  suggestion: AiSuggestion
}

export type OcrLedgerLookups = {
  categories: Category[]
  clients: Client[]
  departments: Department[]
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
  return useSuspenseQuery({
    queryKey: aiSuggestionsQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/ai/suggestions", { credentials: "same-origin" })
      const data = await readApiResponse<{ suggestions: AiSuggestion[] }>(response, "Unable to load AI suggestions")
      return data.suggestions
    },
  })
}

export function useOcrLedgerLookups() {
  return useSuspenseQuery({
    queryKey: ["ocr-ledger-lookups"],
    queryFn: async () => {
      const response = await fetch("/api/transactions?page=1&pageSize=1", { credentials: "same-origin" })
      const data = await readApiResponse<OcrLedgerLookups>(response, "Unable to load ledger fields")
      return data
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

export function useGenerateBriefing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ai/briefing", {
        credentials: "same-origin",
        method: "POST",
      })

      return readApiResponse<{ suggestion: AiSuggestion }>(response, "Unable to generate briefing")
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AiSuggestion[]>(aiSuggestionsQueryKey, (current) => [
        data.suggestion,
        ...(current?.filter((item) => item.id !== data.suggestion.id) ?? []),
      ])
    },
  })
}

export function useGenerateForecast() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ai/forecast", {
        credentials: "same-origin",
        method: "POST",
      })

      return readApiResponse<{ suggestion: AiSuggestion }>(response, "Unable to generate forecast")
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AiSuggestion[]>(aiSuggestionsQueryKey, (current) => [
        data.suggestion,
        ...(current?.filter((item) => item.id !== data.suggestion.id) ?? []),
      ])
    },
  })
}

export function useGenerateOcrDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.set("file", file)

      const response = await fetch("/api/ai/ocr", {
        body: formData,
        credentials: "same-origin",
        method: "POST",
      })

      return readApiResponse<OcrDraftResult>(response, "Unable to parse receipt")
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AiSuggestion[]>(aiSuggestionsQueryKey, (current) => [
        data.suggestion,
        ...(current?.filter((item) => item.id !== data.suggestion.id) ?? []),
      ])
    },
  })
}

export function useCreateOcrLedgerTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ManualTransactionFormValues) => {
      const response = await fetch("/api/transactions", {
        body: JSON.stringify({
          amount: input.amount,
          categoryId: input.categoryId,
          clientId: null,
          currency: input.currency,
          date: input.date,
          departmentId: input.departmentId,
          description: input.description,
          source: "manual",
          subcategoryId: input.subcategoryId || null,
          type: "expense",
          vendor: input.vendor || null,
        }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      return readApiResponse<{ transaction: Transaction }>(response, "Unable to create ledger transaction")
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}
