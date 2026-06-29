import { z } from "zod"

import { BadRequestError } from "@/lib/api/errors"
import { requireAuthContext } from "@/lib/api/auth"
import { requireMembership } from "@/lib/api/permissions"
import { apiError, created, success } from "@/lib/api/responses"
import { categorizeCsvUploadWithOpenRouter } from "@/lib/ai/openrouter"
import { parseCsvUpload, type CsvColumnMapping } from "@/lib/csv/parser"
import { createAiSuggestion } from "@/lib/db/mutations/ai"
import { createImport } from "@/lib/db/mutations/imports"
import { listImportsData } from "@/lib/db/queries/imports"

const MAX_IMPORT_BYTES = 5 * 1024 * 1024

const mappingSchema = z.object({
  amount: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  vendor: z.string().min(1).optional(),
})

export async function GET() {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const data = await listImportsData(context)
    return success(data)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext()
    requireMembership(context)

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      throw new BadRequestError("missing_file", "Upload a CSV file")
    }

    if (file.size > MAX_IMPORT_BYTES) {
      throw new BadRequestError("file_too_large", "CSV uploads are limited to 5 MB")
    }

    const mappingValue = formData.get("mapping")
    const mapping = typeof mappingValue === "string" && mappingValue.trim()
      ? mappingSchema.parse(JSON.parse(mappingValue)) as Partial<CsvColumnMapping>
      : undefined
    const content = await file.text()
    const lookups = await listImportsData(context)
    const parsed = (() => {
      try {
        return parseCsvUpload(content, lookups, mapping)
      } catch (error) {
        throw new BadRequestError("invalid_csv", error instanceof Error ? error.message : "CSV could not be parsed")
      }
    })()
    const categorized = await categorizeCsvUploadWithOpenRouter(parsed, lookups)
    const result = await createImport(context, { filename: file.name, parsed: categorized })

    if (result.stagedRows.length > 0) {
      const averageConfidence = result.stagedRows.reduce((total, row) => total + row.confidence, 0) / result.stagedRows.length
      const needsHuman = result.stagedRows.some((row) => row.reviewState !== "approved")

      try {
        await createAiSuggestion(context, {
          confidence: averageConfidence,
          feature: "categorization",
          filterQuery: null,
          proposedAction: `Review import ${result.import.filename} in the CSV staging workflow before committing rows to the ledger.`,
          reviewState: needsHuman ? "needs_human" : "draft",
          summary: `${result.stagedRows.length} staged row${result.stagedRows.length === 1 ? "" : "s"} categorized from ${result.import.filename}. ${needsHuman ? "Some rows require human review before commit." : "All rows are ready for owner review."}`,
          title: `CSV categorization: ${result.import.filename}`,
          transactionIds: [],
        })
      } catch (error) {
        console.error("[CSV import AI suggestion failed]", error)
      }
    }

    return created(result)
  } catch (error) {
    return apiError(error)
  }
}
