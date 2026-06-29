"use client"

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"

const reviewStateValues = ["approved", "needs_human", "blocked"] as const
const stagedSortByValues = ["rawDate", "rawDescription", "rawAmount", "suggestion", "confidence", "suggestionSource", "validation", "reviewState"] as const
const sortDirValues = ["asc", "desc"] as const

const importParsers = {
  importId: parseAsString,
  stagedPage: parseAsInteger.withDefault(1),
  stagedPageSize: parseAsInteger.withDefault(10),
  stagedReviewState: parseAsStringLiteral(reviewStateValues),
  stagedSearch: parseAsString,
  stagedSortBy: parseAsStringLiteral(stagedSortByValues),
  stagedSortDir: parseAsStringLiteral(sortDirValues),
}

export function useImportsUrlState() {
  const [values, setValues] = useQueryStates(importParsers)

  return [
    {
      importId: values.importId,
      stagedPage: values.stagedPage,
      stagedPageSize: values.stagedPageSize,
      stagedReviewState: values.stagedReviewState,
      stagedSearch: values.stagedSearch,
      stagedSortBy: values.stagedSortBy,
      stagedSortDir: values.stagedSortDir,
    },
    {
      setImportId: (importId: string | null) => setValues({ importId }),
      setStagedPagination: (pagination: { pageIndex: number; pageSize: number }) => setValues({
        stagedPage: pagination.pageIndex + 1,
        stagedPageSize: pagination.pageSize,
      }),
      setStagedReviewState: (stagedReviewState: (typeof reviewStateValues)[number] | null) => setValues({
        stagedPage: 1,
        stagedReviewState,
      }),
      setStagedSearch: (stagedSearch: string) => setValues({
        stagedPage: 1,
        stagedSearch: stagedSearch || null,
      }),
      setStagedSorting: (sorting: Array<{ desc: boolean; id: string }>) => {
        const sort = sorting[0]
        const sortId = sort?.id as (typeof stagedSortByValues)[number] | undefined
        setValues({
          stagedPage: 1,
          stagedSortBy: sortId ?? null,
          stagedSortDir: sort ? (sort.desc ? "desc" : "asc") : null,
        })
      },
    },
  ] as const
}
