import LlamaCloud from "@llamaindex/llama-cloud"
import { OpenRouter } from "@openrouter/sdk"

import { UnprocessableError } from "@/lib/api/errors"

const DEFAULT_LLAMA_PARSE_VERSION = "latest"
const DEFAULT_OPENROUTER_MODEL = "cohere/north-mini-code:free"

const RECEIPT_PARSE_PROMPT = [
  "This is a receipt or invoice for a business ledger.",
  "Preserve the vendor name, invoice or receipt date, total amount, currency, tax/VAT, and line items.",
  "Keep currency symbols and original labels visible in the markdown.",
  "Do not summarize or infer missing financial values.",
].join(" ")

export type OcrDraftTransaction = {
  amount: number | null
  confidence: number
  currency: "AED" | "USD" | null
  date: string | null
  description: string
  lineItems: string[]
  rawTextPreview: string
  vendor: string | null
}

export type LlamaParseReceiptResult = {
  confidence: number
  fileId: string | null
  jobId: string | null
  markdown: string
  metadata: unknown
  pageCount: number
}

type LlamaParseResultLike = {
  job?: {
    id?: string
    status?: string
  }
  markdown?: {
    pages?: Array<{ markdown?: string; page_number?: number }>
  }
  markdown_full?: string
  metadata?: {
    pages?: Array<{ confidence?: number; page_number?: number }>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function contentToText(content: unknown) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map((part) => {
      if (typeof part === "string") return part
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text
      return ""
    })
    .join("\n")
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function normalizeLine(line: string) {
  return line
    .replace(/^#+\s*/, "")
    .replace(/[|*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getMarkdownFromResult(result: LlamaParseResultLike) {
  if (typeof result.markdown_full === "string" && result.markdown_full.trim()) {
    return result.markdown_full
  }

  return result.markdown?.pages
    ?.map((page) => page.markdown?.trim())
    .filter(Boolean)
    .join("\n\n") ?? ""
}

function getConfidenceFromResult(result: LlamaParseResultLike) {
  const values = result.metadata?.pages
    ?.map((page) => page.confidence)
    .filter((confidence): confidence is number => typeof confidence === "number" && Number.isFinite(confidence)) ?? []

  if (values.length === 0) return 0.72

  return Math.min(0.98, Math.max(0.1, values.reduce((total, value) => total + value, 0) / values.length))
}

function detectCurrency(text: string): "AED" | "USD" | null {
  const upper = text.toUpperCase()
  if (/\b(AED|DHS|DIRHAM|د\.إ)\b/.test(upper)) return "AED"
  if (/\b(USD|US\$)\b|\$/.test(upper)) return "USD"
  return null
}

function parseAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value
  if (typeof value !== "string") return null

  const normalized = value.replace(/[^\d.,-]/g, "").replace(/,/g, "")
  const amount = Number.parseFloat(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function findAmount(markdown: string) {
  const lines = markdown.split(/\r?\n/).map(normalizeLine).filter(Boolean)
  const totalLines = lines.filter((line) =>
    /\b(grand total|total due|amount due|balance due|invoice total|total)\b/i.test(line) &&
    !/\b(subtotal|sub total|tax|vat|discount|change)\b/i.test(line)
  )
  const lineCandidates = totalLines.flatMap((line) => extractNumberCandidates(line))

  if (lineCandidates.length > 0) {
    return lineCandidates[lineCandidates.length - 1]
  }

  const currencyLines = lines.filter((line) => detectCurrency(line))
  const currencyCandidates = currencyLines.flatMap((line) => extractNumberCandidates(line))
  if (currencyCandidates.length > 0) return Math.max(...currencyCandidates)

  const allCandidates = lines.flatMap((line) => extractNumberCandidates(line))
  return allCandidates.length > 0 ? Math.max(...allCandidates) : null
}

function extractNumberCandidates(line: string) {
  return Array.from(line.matchAll(/(?:AED|USD|US\$|DHS|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi))
    .map((match) => parseAmount(match[1]))
    .filter((amount): amount is number => amount !== null && amount < 1_000_000)
}

function toIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null
  const text = value.trim()
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const slashed = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2}|\d{2})\b/)
  if (slashed) {
    const year = Number(slashed[3].length === 2 ? `20${slashed[3]}` : slashed[3])
    return toIsoDate(year, Number(slashed[2]), Number(slashed[1]))
  }

  const monthNames: Record<string, number> = {
    apr: 4,
    april: 4,
    aug: 8,
    august: 8,
    dec: 12,
    december: 12,
    feb: 2,
    february: 2,
    jan: 1,
    january: 1,
    jul: 7,
    july: 7,
    jun: 6,
    june: 6,
    mar: 3,
    march: 3,
    may: 5,
    nov: 11,
    november: 11,
    oct: 10,
    october: 10,
    sep: 9,
    september: 9,
  }
  const named = text.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2}|\d{2})\b/)
  if (!named) return null

  const month = monthNames[named[2].toLowerCase()]
  if (!month) return null

  const year = Number(named[3].length === 2 ? `20${named[3]}` : named[3])
  return toIsoDate(year, month, Number(named[1]))
}

function findDate(markdown: string) {
  const lines = markdown.split(/\r?\n/).map(normalizeLine).filter(Boolean)
  const dateLine = lines.find((line) => /\b(date|issued|invoice date|receipt date)\b/i.test(line) && parseDate(line))
  if (dateLine) return parseDate(dateLine)

  for (const line of lines) {
    const parsed = parseDate(line)
    if (parsed) return parsed
  }

  return null
}

function findVendor(markdown: string, filename: string) {
  const lines = markdown.split(/\r?\n/).map(normalizeLine).filter(Boolean)
  const vendor = lines.find((line) =>
    line.length >= 2 &&
    line.length <= 80 &&
    !/\b(receipt|invoice|tax invoice|bill|total|amount|date|payment|qty|quantity|description|price)\b/i.test(line) &&
    !/^[\d\s.,:/#-]+$/.test(line)
  )

  return vendor ?? filename.replace(/\.[^.]+$/, "")
}

function extractLineItems(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length >= 4 && /\d/.test(line) && !/\b(total|subtotal|tax|vat|balance|amount due)\b/i.test(line))
    .slice(0, 5)
}

function extractReceiptDraftHeuristically(markdown: string, filename: string): OcrDraftTransaction {
  const amount = findAmount(markdown)
  const currency = detectCurrency(markdown)
  const date = findDate(markdown)
  const vendor = findVendor(markdown, filename)
  const confidence = Math.min(
    0.82,
    0.28 + (amount ? 0.2 : 0) + (currency ? 0.12 : 0) + (date ? 0.18 : 0) + (vendor ? 0.14 : 0)
  )

  return {
    amount,
    confidence,
    currency,
    date,
    description: vendor ? `Receipt/invoice from ${vendor}` : `Receipt/invoice from ${filename}`,
    lineItems: extractLineItems(markdown),
    rawTextPreview: markdown.slice(0, 1200),
    vendor,
  }
}

function normalizeDraftValue(parsed: Record<string, unknown>, fallback: OcrDraftTransaction): OcrDraftTransaction {
  const amount = parseAmount(parsed.amount) ?? fallback.amount
  const currency = parsed.currency === "AED" || parsed.currency === "USD" ? parsed.currency : fallback.currency
  const date = parseDate(parsed.date) ?? fallback.date
  const vendor = typeof parsed.vendor === "string" && parsed.vendor.trim() ? parsed.vendor.trim() : fallback.vendor
  const description = typeof parsed.description === "string" && parsed.description.trim()
    ? parsed.description.trim()
    : fallback.description
  const lineItems = Array.isArray(parsed.lineItems)
    ? parsed.lineItems.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8)
    : fallback.lineItems
  const modelConfidence = typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
    ? parsed.confidence
    : fallback.confidence

  return {
    amount,
    confidence: Math.min(0.95, Math.max(fallback.confidence, modelConfidence)),
    currency,
    date,
    description,
    lineItems,
    rawTextPreview: fallback.rawTextPreview,
    vendor,
  }
}

export async function parseReceiptWithLlamaParse(file: File): Promise<LlamaParseReceiptResult> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY
  if (!apiKey) {
    throw new UnprocessableError("Llama Cloud API key is not configured")
  }

  const client = new LlamaCloud({ apiKey })
  const uploadedFile = await client.files.create({ file, purpose: "parse" })
  const result = await client.parsing.parse({
    agentic_options: {
      custom_prompt: RECEIPT_PARSE_PROMPT,
    },
    expand: ["markdown_full", "metadata"],
    file_id: uploadedFile.id,
    input_options: {
      image: {
        camera_photo_correction: true,
      },
    },
    output_options: {
      markdown: {
        tables: {
          merge_continued_tables: true,
          output_tables_as_markdown: true,
        },
      },
    },
    processing_options: {
      ocr_parameters: {
        languages: ["en"],
      },
    },
    tier: "agentic",
    version: process.env.LLAMA_PARSE_VERSION ?? DEFAULT_LLAMA_PARSE_VERSION,
  })
  const parsedResult = result as LlamaParseResultLike
  const markdown = getMarkdownFromResult(parsedResult)

  if (!markdown.trim()) {
    throw new UnprocessableError("LlamaParse did not return readable receipt text")
  }

  return {
    confidence: getConfidenceFromResult(parsedResult),
    fileId: uploadedFile.id ?? null,
    jobId: parsedResult.job?.id ?? null,
    markdown,
    metadata: parsedResult.metadata ?? null,
    pageCount: parsedResult.metadata?.pages?.length ?? parsedResult.markdown?.pages?.length ?? 1,
  }
}

export async function extractReceiptDraftFromMarkdown(markdown: string, filename: string): Promise<OcrDraftTransaction> {
  const fallback = extractReceiptDraftHeuristically(markdown, filename)
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return fallback

  const client = new OpenRouter({ apiKey })
  const model = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL

  try {
    const response = await client.chat.send({
      chatRequest: {
        maxTokens: 500,
        messages: [
          {
            content: "Extract one draft ledger transaction from receipt/invoice OCR markdown. Return only valid JSON. Use null for unknown values. Do not invent missing amounts, dates, vendors, or currencies.",
            role: "system",
          },
          {
            content: JSON.stringify({
              expectedOutput: {
                amount: 260.5,
                confidence: 0.82,
                currency: "USD or AED or null",
                date: "YYYY-MM-DD or null",
                description: "short ledger description",
                lineItems: ["optional line item text"],
                vendor: "vendor name or null",
              },
              filename,
              markdown: markdown.slice(0, 6000),
            }),
            role: "user",
          },
        ],
        model,
        temperature: 0.1,
      },
    })
    const parsed = parseJsonObject(contentToText(response.choices[0]?.message.content))
    return parsed ? normalizeDraftValue(parsed, fallback) : fallback
  } catch (error) {
    console.error("[OpenRouter OCR extraction failed]", error)
    return fallback
  }
}
