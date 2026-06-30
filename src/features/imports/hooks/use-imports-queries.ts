"use client"

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"

import type { Category, CsvImport, CsvMappingFormValues, CsvStagedRow, Department, Transaction } from "@/domain/types"

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } }

export type ImportsData = {
  categories: Category[]
  departments: Department[]
  imports: CsvImport[]
}

type UploadCsvInput = {
  file: File
  mapping: CsvMappingFormValues
}

type UpdateStagedRowInput = {
  importId: string
  patch: Partial<CsvStagedRow>
  rowId: string
}

export type StagedRowsFilters = {
  page: number
  pageSize: number
  reviewState?: CsvStagedRow["reviewState"]
  search?: string
  sortBy?: string
  sortDir?: "asc" | "desc"
}

export type StagedRowsData = {
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
  stagedRows: CsvStagedRow[]
  summary: {
    approvedCount: number
    blockedCount: number
    committableCount: number
    lowConfidenceCount: number
  }
}

async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload && !payload.ok ? payload.error.message : fallbackMessage)
  }

  return payload.data
}

export const importsQueryKey = ["imports"] as const
export const stagedRowsQueryKey = (importId: string | null | undefined) => ["imports", importId, "staged-rows"] as const
export const stagedRowsQueryOptionsKey = (importId: string | null | undefined, filters: StagedRowsFilters) => [...stagedRowsQueryKey(importId), filters] as const

export function useImportsData() {
  return useSuspenseQuery({
    queryKey: importsQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/imports", { credentials: "same-origin" })
      return readApiResponse<ImportsData>(response, "Unable to load imports")
    },
  })
}

export function useStagedRows(importId: string | null | undefined, filters: StagedRowsFilters) {
  return useSuspenseQuery({
    queryKey: stagedRowsQueryOptionsKey(importId, filters),
    queryFn: async () => {
      if (!importId) {
        return {
          pagination: {
            page: filters.page,
            pageSize: filters.pageSize,
            totalPages: 0,
            totalRows: 0,
          },
          stagedRows: [],
          summary: {
            approvedCount: 0,
            blockedCount: 0,
            committableCount: 0,
            lowConfidenceCount: 0,
          },
        } satisfies StagedRowsData
      }

      const params = new URLSearchParams()

      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value))
        }
      }

      const query = params.toString()
      const response = await fetch(`/api/imports/${encodeURIComponent(importId)}/staged-rows${query ? `?${query}` : ""}`, {
        credentials: "same-origin",
      })
      return readApiResponse<StagedRowsData>(response, "Unable to load staged rows")
    },
  })
}

export function useUploadCsv() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UploadCsvInput) => {
      const formData = new FormData()
      formData.set("file", input.file)
      formData.set("mapping", JSON.stringify(input.mapping))

      const response = await fetch("/api/imports", {
        body: formData,
        credentials: "same-origin",
        method: "POST",
      })

      return readApiResponse<{ import: CsvImport; stagedRows: CsvStagedRow[] }>(response, "Unable to upload CSV")
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: importsQueryKey })
      await queryClient.invalidateQueries({ queryKey: stagedRowsQueryKey(data.import.id) })
    },
  })
}

export function useUpdateStagedRow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateStagedRowInput) => {
      const response = await fetch(
        `/api/imports/${encodeURIComponent(input.importId)}/staged-rows/${encodeURIComponent(input.rowId)}`,
        {
          body: JSON.stringify(input.patch),
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }
      )

      return readApiResponse<{ stagedRow: CsvStagedRow }>(response, "Unable to update staged row")
    },
    onSuccess: (data, input) => {
      queryClient.setQueriesData<StagedRowsData>({ queryKey: stagedRowsQueryKey(input.importId) }, (current) =>
        current
          ? {
              ...current,
              stagedRows: current.stagedRows.map((row) => row.id === input.rowId ? data.stagedRow : row),
            }
          : current
      )
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: stagedRowsQueryKey(input.importId) })
    },
  })
}

export function useCommitImport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (importId: string) => {
      const response = await fetch(`/api/imports/${encodeURIComponent(importId)}/commit`, {
        credentials: "same-origin",
        method: "POST",
      })

      return readApiResponse<{ import: CsvImport; transactions: Transaction[] }>(response, "Unable to commit import")
    },
    onSuccess: async (data, importId) => {
      queryClient.setQueryData<ImportsData>(importsQueryKey, (current) => current
        ? {
            ...current,
            imports: current.imports.map((item) => item.id === data.import.id ? data.import : item),
          }
        : current)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: importsQueryKey }),
        queryClient.invalidateQueries({ queryKey: stagedRowsQueryKey(importId) }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["metrics"] }),
      ])
    },
  })
}

export function useReverseImport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (importId: string) => {
      const response = await fetch(`/api/imports/${encodeURIComponent(importId)}/reverse`, {
        credentials: "same-origin",
        method: "POST",
      })

      return readApiResponse<{ import: CsvImport; transactions: Transaction[] }>(response, "Unable to reverse import")
    },
    onSuccess: async (data, importId) => {
      queryClient.setQueryData<ImportsData>(importsQueryKey, (current) => current
        ? {
            ...current,
            imports: current.imports.map((item) => item.id === data.import.id ? data.import : item),
          }
        : current)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: importsQueryKey }),
        queryClient.invalidateQueries({ queryKey: stagedRowsQueryKey(importId) }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["metrics"] }),
      ])
    },
  })
}
