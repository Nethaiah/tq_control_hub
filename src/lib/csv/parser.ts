import { createHash } from "node:crypto"
import Papa from "papaparse"

import type { Category, Department } from "@/domain/types"

export type CsvColumnMapping = {
  amount: string
  currency: string
  date: string
  description: string
  vendor?: string
}

export type ParsedCsvStagedRow = {
  confidence: number
  currency: "USD" | "AED" | null
  duplicate: boolean
  parsedAmount: number | null
  parsedDate: string | null
  rawAmount: string
  rawDate: string
  rawDescription: string
  reviewState: "approved" | "needs_human" | "blocked"
  suggestionModel: string | null
  suggestionSource: "keyword" | "openrouter" | "manual"
  suggestedCategoryId: string | null
  suggestedDepartmentId: string | null
  suggestedSubcategoryId: string | null
  validationIssues: string[]
}

export type ParsedCsvUpload = {
  columnMapping: CsvColumnMapping
  delimiter: string
  encoding: string
  fileHash: string
  headerRow: number
  rowCount: number
  rows: ParsedCsvStagedRow[]
}

type ParserLookup = {
  categories: Category[]
  departments: Department[]
}

const HEADER_ALIASES: Record<keyof CsvColumnMapping, string[]> = {
  amount: ["amount", "debit", "credit", "value", "total"],
  currency: ["currency", "ccy"],
  date: ["date", "transaction date", "posted date", "created", "day"],
  description: ["description", "memo", "details", "narrative", "merchant", "vendor"],
  vendor: ["vendor", "merchant", "supplier", "payee"],
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

function findHeader(headers: string[], target: keyof CsvColumnMapping) {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }))
  const aliases = HEADER_ALIASES[target]
  return normalizedHeaders.find((item) => aliases.includes(item.normalized))?.header
}

function parseDate(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const formatDate = (year: string, month: string, day: string) => {
    const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    const parsed = new Date(`${normalized}T00:00:00.000Z`)

    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toISOString().slice(0, 10) === normalized ? normalized : null
  }

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return formatDate(year, month, day)
  }

  const slashMatch = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/.exec(trimmed)
  if (slashMatch) {
    const [, first, second, rawYear] = slashMatch
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return formatDate(year, first, second)
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  const normalized = parsed.toISOString().slice(0, 10)
  return normalized === "Invalid Date" ? null : normalized
}

function parseAmount(value: string) {
  const normalized = value.replace(/,/g, "").replace(/[^0-9.-]/g, "").trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Number(parsed.toFixed(2))
}

function parseCurrency(value: string) {
  const normalized = value.trim().toUpperCase()
  if (normalized === "USD" || normalized === "AED") return normalized
  return null
}

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word))
}

function findDepartment(departments: Department[], description: string) {
  const text = description.toLowerCase()
  const rules: Array<[string[], string[]]> = [
    [["Development"], ["engineer", "developer", "database", "hosting", "supabase", "vercel", "claude", "api usage", "build"]],
    [["Design"], ["designer", "design", "figma"]],
    [["Marketing"], ["meta", "ad spend", "marketing", "content", "sponsorship"]],
    [["Operations / G&A", "Operations"], ["accounting", "legal", "office", "rent", "automation", "n8n", "overhead"]],
    [["Sales"], ["sales", "commission", "crm", "strategy"]],
    [["Onboarding / Client Success", "Onboarding"], ["retainer", "onboarding", "support", "success"]],
  ]

  for (const [departmentNames, words] of rules) {
    if (!includesAny(text, words)) continue
    const department = departments.find((item) => departmentNames.some((name) => item.name.includes(name)))
    if (department) return department.id
  }

  return departments.find((item) => item.name.includes("Operations"))?.id ?? departments[0]?.id ?? null
}

function findCategory(categories: Category[], description: string) {
  const text = description.toLowerCase()
  const expenseCategories = categories.filter((category) => category.kind === "expense" && !category.parentId && !category.archived)
  const rules: Array<[string[], string[]]> = [
    [["Payroll"], ["salary", "payroll", "wage"]],
    [["Contractors"], ["contractor", "freelancer", "freelance"]],
    [["Marketing & ad spend", "Ad spend"], ["meta", "ad spend", "paid media", "marketing"]],
    [["Software & subscriptions", "Software"], ["software", "subscription", "automation", "n8n", "claude", "api"]],
    [["Tools & infrastructure", "Tools"], ["database", "hosting", "domain", "storage", "vercel", "supabase"]],
    [["Professional services"], ["accounting", "legal", "advisory"]],
  ]

  for (const [categoryNames, words] of rules) {
    if (!includesAny(text, words)) continue
    const category = expenseCategories.find((item) => categoryNames.some((name) => item.name.includes(name)))
    if (category) return category.id
  }

  return expenseCategories[0]?.id ?? null
}

function confidenceFor(row: Pick<ParsedCsvStagedRow, "currency" | "parsedAmount" | "parsedDate" | "suggestedCategoryId" | "suggestedDepartmentId" | "validationIssues">) {
  if (row.validationIssues.length > 0) return 0.2
  if (row.currency && row.parsedAmount && row.parsedDate && row.suggestedCategoryId && row.suggestedDepartmentId) return 0.82
  return 0.45
}

function rowFingerprint(row: ParsedCsvStagedRow) {
  return `${row.parsedDate ?? row.rawDate}|${row.rawDescription.trim().toLowerCase()}|${row.parsedAmount ?? row.rawAmount}|${row.currency ?? ""}`
}

export function hashCsvContent(content: string) {
  return createHash("sha256").update(content).digest("hex")
}

export function parseCsvUpload(content: string, lookup: ParserLookup, mappingOverride?: Partial<CsvColumnMapping>): ParsedCsvUpload {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.some((error) => error.type === "Delimiter" || error.type === "Quotes")) {
    throw new Error(parsed.errors[0]?.message ?? "CSV could not be parsed")
  }

  const headers = parsed.meta.fields ?? []
  const columnMapping = {
    amount: mappingOverride?.amount ?? findHeader(headers, "amount") ?? "",
    currency: mappingOverride?.currency ?? findHeader(headers, "currency") ?? "",
    date: mappingOverride?.date ?? findHeader(headers, "date") ?? "",
    description: mappingOverride?.description ?? findHeader(headers, "description") ?? "",
    vendor: mappingOverride?.vendor ?? findHeader(headers, "vendor"),
  }

  const missingColumns = (["date", "description", "amount", "currency"] as const).filter((key) => !columnMapping[key])
  if (missingColumns.length > 0) {
    throw new Error(`Missing required CSV columns: ${missingColumns.join(", ")}`)
  }

  const seen = new Set<string>()
  const rows = parsed.data.map((record) => {
    const rawDate = record[columnMapping.date] ?? ""
    const rawAmount = record[columnMapping.amount] ?? ""
    const rawDescription = record[columnMapping.description] ?? ""
    const rawCurrency = record[columnMapping.currency] ?? ""
    const vendor = columnMapping.vendor ? record[columnMapping.vendor] : undefined
    const description = vendor && !rawDescription.toLowerCase().includes(vendor.toLowerCase())
      ? `${rawDescription} - ${vendor}`
      : rawDescription
    const parsedDate = parseDate(rawDate)
    const parsedAmount = parseAmount(rawAmount)
    const currency = parseCurrency(rawCurrency)
    const validationIssues: string[] = []

    if (!parsedDate) validationIssues.push("Bad date")
    if (!parsedAmount) validationIssues.push("Missing or invalid amount")
    if (!currency) validationIssues.push("Unsupported currency")
    if (!description.trim()) validationIssues.push("Missing description")

    const suggestedDepartmentId = findDepartment(lookup.departments, description)
    const suggestedCategoryId = findCategory(lookup.categories, description)
    const row: ParsedCsvStagedRow = {
      confidence: 0,
      currency,
      duplicate: false,
      parsedAmount,
      parsedDate,
      rawAmount,
      rawDate,
      rawDescription: description.trim(),
      reviewState: "needs_human",
      suggestionModel: null,
      suggestionSource: "keyword",
      suggestedCategoryId,
      suggestedDepartmentId,
      suggestedSubcategoryId: null,
      validationIssues,
    }

    const fingerprint = rowFingerprint(row)
    row.duplicate = seen.has(fingerprint)
    if (row.duplicate) row.validationIssues.push("Duplicate row in file")
    seen.add(fingerprint)

    row.confidence = confidenceFor(row)
    row.reviewState = row.validationIssues.length > 0 ? "blocked" : row.confidence >= 0.8 ? "approved" : "needs_human"
    return row
  })

  return {
    columnMapping,
    delimiter: parsed.meta.delimiter || ",",
    encoding: "utf-8",
    fileHash: hashCsvContent(content),
    headerRow: 1,
    rowCount: rows.length,
    rows,
  }
}
