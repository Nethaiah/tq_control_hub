"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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

async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload && !payload.ok ? payload.error.message : fallbackMessage)
  }

  return payload.data
}

export const importsQueryKey = ["imports"] as const
export const stagedRowsQueryKey = (importId: string | null | undefined) => ["imports", importId, "staged-rows"] as const

export function useImportsData() {
  return useQuery({
    queryKey: importsQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/imports", { credentials: "same-origin" })
      return readApiResponse<ImportsData>(response, "Unable to load imports")
    },
  })
}

export function useStagedRows(importId: string | null | undefined) {
  return useQuery({
    enabled: Boolean(importId),
    queryKey: stagedRowsQueryKey(importId),
    queryFn: async () => {
      const response = await fetch(`/api/imports/${encodeURIComponent(importId!)}/staged-rows`, {
        credentials: "same-origin",
      })
      const data = await readApiResponse<{ stagedRows: CsvStagedRow[] }>(response, "Unable to load staged rows")
      return data.stagedRows
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
      queryClient.setQueryData(stagedRowsQueryKey(data.import.id), data.stagedRows)
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
    onMutate: async (input) => {
      const key = stagedRowsQueryKey(input.importId)
      await queryClient.cancelQueries({ queryKey: key })
      const previousRows = queryClient.getQueryData<CsvStagedRow[]>(key)

      queryClient.setQueryData<CsvStagedRow[]>(key, (current) =>
        current?.map((row) => row.id === input.rowId ? { ...row, ...input.patch } : row) ?? []
      )

      return { previousRows }
    },
    onError: (_error, input, context) => {
      queryClient.setQueryData(stagedRowsQueryKey(input.importId), context?.previousRows)
    },
    onSuccess: (data, input) => {
      queryClient.setQueryData<CsvStagedRow[]>(stagedRowsQueryKey(input.importId), (current) =>
        current?.map((row) => row.id === input.rowId ? data.stagedRow : row) ?? [data.stagedRow]
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
