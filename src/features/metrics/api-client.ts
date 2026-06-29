import { filtersToSearchParams } from "@/domain/filters"
import type { TransactionFilters } from "@/domain/types"

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code?: string; message: string; details?: unknown } }

export async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload && !payload.ok ? payload.error.message : fallbackMessage)
  }

  return payload.data
}

export function filtersToQuery(filters: TransactionFilters): string {
  const params = filtersToSearchParams(filters)
  const query = params.toString()
  return query ? `?${query}` : ""
}