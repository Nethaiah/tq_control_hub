import { BadRequestError } from "@/lib/api/errors"
import { requireAuthContext } from "@/lib/api/auth"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, created } from "@/lib/api/responses"
import { categorizeRowsWithOpenRouter } from "@/lib/ai/openrouter"
import { extractReceiptDraftFromMarkdown, parseReceiptWithLlamaParse } from "@/lib/ai/llamaparse"
import { createAiSuggestion } from "@/lib/db/mutations/ai"
import { loadAiQueryLookups } from "@/lib/db/queries/ai"

export const runtime = "nodejs"

const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
])
const ACCEPTED_EXTENSIONS = new Set([".heic", ".heif", ".jpeg", ".jpg", ".pdf", ".png", ".webp"])

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File
}

function extensionFor(filename: string) {
  const dotIndex = filename.lastIndexOf(".")
  return dotIndex === -1 ? "" : filename.slice(dotIndex).toLowerCase()
}

function validateOcrFile(file: File) {
  if (file.size === 0) {
    throw new BadRequestError("empty_file", "Upload a receipt or invoice file")
  }

  if (file.size > MAX_OCR_FILE_SIZE) {
    throw new BadRequestError("file_too_large", "Receipt OCR files must be 10MB or smaller")
  }

  const hasAcceptedType = file.type ? ACCEPTED_MIME_TYPES.has(file.type) : false
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.has(extensionFor(file.name))

  if (!hasAcceptedType && !hasAcceptedExtension) {
    throw new BadRequestError(
      "unsupported_file_type",
      "Upload a PDF, JPG, PNG, WebP, HEIC, or HEIF receipt/invoice"
    )
  }
}

function formatMoney(amount: number | null, currency: "AED" | "USD" | null) {
  if (amount === null) return "unknown amount"
  return `${currency ?? "unknown currency"} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

function buildSummary(input: {
  amount: number | null
  categoryName?: string
  currency: "AED" | "USD" | null
  date: string | null
  departmentName?: string
  filename: string
  vendor: string | null
}) {
  const vendor = input.vendor ?? input.filename
  const date = input.date ?? "unknown date"
  const category = input.categoryName ? ` Suggested category: ${input.categoryName}.` : ""
  const department = input.departmentName ? ` Suggested department: ${input.departmentName}.` : ""

  return `LlamaParse extracted a draft expense from ${vendor} for ${formatMoney(input.amount, input.currency)} dated ${date}.${department}${category} Review the source document before creating a ledger transaction.`
}

function buildProposedAction(input: {
  amount: number | null
  categoryId?: string
  categoryName?: string
  confidence: number
  currency: "AED" | "USD" | null
  date: string | null
  departmentId?: string
  departmentName?: string
  description: string
  filename: string
  jobId: string | null
  lineItems: string[]
  vendor: string | null
}) {
  return JSON.stringify({
    draftTransaction: {
      amount: input.amount,
      categoryId: input.categoryId ?? null,
      categoryName: input.categoryName ?? null,
      currency: input.currency,
      date: input.date,
      departmentId: input.departmentId ?? null,
      departmentName: input.departmentName ?? null,
      description: input.description,
      lineItems: input.lineItems,
      source: "manual_review_after_ocr",
      type: "expense",
      vendor: input.vendor,
    },
    guardrail: "Draft only. Create or edit a ledger transaction only after human review.",
    parse: {
      confidence: input.confidence,
      filename: input.filename,
      jobId: input.jobId,
      provider: "LlamaParse",
      tier: "agentic",
    },
  }, null, 2)
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const formData = await request.formData()
    const file = formData.get("file")

    if (!isUploadedFile(file)) {
      throw new BadRequestError("missing_file", "Upload a receipt or invoice file")
    }

    validateOcrFile(file)

    const parsedReceipt = await parseReceiptWithLlamaParse(file)
    const draft = await extractReceiptDraftFromMarkdown(parsedReceipt.markdown, file.name)
    const lookups = await loadAiQueryLookups(context)
    const [categorization] = await categorizeRowsWithOpenRouter([
      {
        amount: draft.amount,
        currency: draft.currency,
        description: [draft.vendor, draft.description, ...draft.lineItems].filter(Boolean).join(" "),
        rawDate: draft.date,
      },
    ], {
      categories: lookups.categories,
      departments: lookups.departments,
    })
    const confidence = Math.min(
      0.96,
      Math.max(0.1, (parsedReceipt.confidence + draft.confidence + (categorization?.confidence ?? 0.4)) / 3)
    )
    const reviewState = confidence >= 0.75 && draft.amount && draft.currency && draft.date ? "draft" : "needs_human"
    const summary = buildSummary({
      amount: draft.amount,
      categoryName: categorization?.categoryName,
      currency: draft.currency,
      date: draft.date,
      departmentName: categorization?.departmentName,
      filename: file.name,
      vendor: draft.vendor,
    })
    const proposedAction = buildProposedAction({
      amount: draft.amount,
      categoryId: categorization?.categoryId,
      categoryName: categorization?.categoryName,
      confidence,
      currency: draft.currency,
      date: draft.date,
      departmentId: categorization?.departmentId,
      departmentName: categorization?.departmentName,
      description: draft.description,
      filename: file.name,
      jobId: parsedReceipt.jobId,
      lineItems: draft.lineItems,
      vendor: draft.vendor,
    })
    const suggestion = await createAiSuggestion(context, {
      confidence,
      feature: "ocr",
      proposedAction,
      reviewState,
      summary,
      title: `OCR draft: ${draft.vendor ?? file.name}`,
      transactionIds: [],
    })

    return created({
      draft: {
        ...draft,
        categoryId: categorization?.categoryId ?? null,
        categoryName: categorization?.categoryName ?? null,
        departmentId: categorization?.departmentId ?? null,
        departmentName: categorization?.departmentName ?? null,
      },
      parse: {
        confidence: parsedReceipt.confidence,
        fileId: parsedReceipt.fileId,
        jobId: parsedReceipt.jobId,
        pageCount: parsedReceipt.pageCount,
        provider: "LlamaParse",
        tier: "agentic",
      },
      suggestion,
    })
  } catch (error) {
    return apiError(error)
  }
}
