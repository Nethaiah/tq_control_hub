import { and, eq, inArray } from "drizzle-orm"

import type { CsvStagedRow, Transaction } from "@/domain/types"
import type { AuthOrganizationContext } from "@/lib/api/auth"
import { ConflictError, NotFoundError, UnprocessableError } from "@/lib/api/errors"
import type { ParsedCsvUpload } from "@/lib/csv/parser"

import { db } from "../index"
import { auditLogs, categories, csvImports, csvStagedRows, departments, transactions } from "../schema"
import { getImportForOrganization, getStagedRowForImport, toCsvImport, toCsvStagedRow } from "../queries/imports"

export type CreateImportInput = {
  filename: string
  parsed: ParsedCsvUpload
}

export type UpdateStagedRowInput = Partial<{
  currency: "USD" | "AED" | null
  duplicate: boolean
  parsedAmount: number | null
  parsedDate: string | null
  reviewState: "approved" | "needs_human" | "blocked"
  suggestedCategoryId: string | null
  suggestedDepartmentId: string | null
  suggestedSubcategoryId: string | null
  validationIssues: string[]
}>

function fxRateForCurrency(currency: "USD" | "AED") {
  return currency === "AED" ? 0.2723 : 1
}

function importAttachmentUrl(importId: string, filename: string) {
  return `/imports/${importId}/${filename}`
}

function isValidIsoDate(value: string | null | undefined) {
  if (!value) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validationIssuesForRow(row: {
  currency: "USD" | "AED" | null
  duplicate: boolean
  parsedAmount: number | null
  parsedDate: string | null
  rawDescription: string
  suggestedCategoryId: string | null
  suggestedDepartmentId: string | null
}) {
  const issues: string[] = []

  if (!isValidIsoDate(row.parsedDate)) issues.push("Bad date")
  if (!row.parsedAmount || row.parsedAmount <= 0) issues.push("Missing or invalid amount")
  if (!row.currency) issues.push("Unsupported currency")
  if (!row.rawDescription.trim()) issues.push("Missing description")
  if (!row.suggestedDepartmentId) issues.push("Missing department")
  if (!row.suggestedCategoryId) issues.push("Missing category")
  if (row.duplicate) issues.push("Duplicate transaction already exists")

  return issues
}

async function transactionDuplicateExists(organizationId: string, row: {
  parsedAmount: number | null
  parsedDate: string | null
  rawDescription: string
}) {
  if (!row.parsedDate || !row.parsedAmount) return false

  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.organizationId, organizationId),
        eq(transactions.status, "active"),
        eq(transactions.date, row.parsedDate),
        eq(transactions.amount, row.parsedAmount),
        eq(transactions.description, row.rawDescription)
      )
    )
    .limit(1)

  return Boolean(existing)
}

function toTransaction(row: typeof transactions.$inferSelect): Transaction {
  return {
    amount: row.amount,
    attachmentUrl: row.attachmentUrl,
    categoryId: row.categoryId,
    clientId: row.clientId,
    createdBy: row.createdBy,
    currency: row.currency,
    date: row.date,
    departmentId: row.departmentId,
    description: row.description,
    fxRateToUsd: row.fxRateToUsd,
    id: row.id,
    recurrenceId: row.recurrenceId,
    recurring: row.recurring,
    source: row.source,
    subcategoryId: row.subcategoryId,
    type: row.type,
    vendor: row.vendor,
  }
}

async function markExistingTransactionDuplicates(organizationId: string, rows: ParsedCsvUpload["rows"]) {
  const dates = Array.from(new Set(rows.map((row) => row.parsedDate).filter((date): date is string => Boolean(date))))
  if (dates.length === 0) return rows

  const existingRows = await db
    .select({ amount: transactions.amount, date: transactions.date, description: transactions.description })
    .from(transactions)
    .where(and(eq(transactions.organizationId, organizationId), eq(transactions.status, "active"), inArray(transactions.date, dates)))

  return rows.map((row) => {
    const duplicate = existingRows.some(
      (transaction) =>
        transaction.date === row.parsedDate &&
        transaction.amount === row.parsedAmount &&
        transaction.description.trim().toLowerCase() === row.rawDescription.trim().toLowerCase()
    )

    if (!duplicate) return row

    return {
      ...row,
      duplicate: true,
      reviewState: "blocked" as const,
      validationIssues: Array.from(new Set([...row.validationIssues, "Duplicate transaction already exists"])),
    }
  })
}

export async function createImport(context: AuthOrganizationContext, input: CreateImportInput) {
  const organizationId = context.organization.id
  const duplicateImport = await db
    .select()
    .from(csvImports)
    .where(and(eq(csvImports.organizationId, organizationId), eq(csvImports.fileHash, input.parsed.fileHash)))
    .limit(1)

  if (duplicateImport[0]) {
    const [blocked] = await db
      .insert(csvImports)
      .values({
        columnMapping: input.parsed.columnMapping,
        delimiter: input.parsed.delimiter,
        duplicateOfImportId: duplicateImport[0].id,
        encoding: input.parsed.encoding,
        fileHash: input.parsed.fileHash,
        filename: input.filename,
        headerRow: input.parsed.headerRow,
        organizationId,
        rowCount: input.parsed.rowCount,
        status: "blocked_duplicate",
        uploadedAt: new Date(),
      })
      .returning()

    await db.insert(auditLogs).values({
      action: "csv_import.duplicate_blocked",
      actorId: context.user.id,
      entityId: blocked.id,
      entityType: "csv_import",
      metadata: { duplicateOfImportId: duplicateImport[0].id, fileHash: input.parsed.fileHash },
      organizationId,
    })

    return { import: toCsvImport(blocked), stagedRows: [] as CsvStagedRow[] }
  }

  const rows = await markExistingTransactionDuplicates(organizationId, input.parsed.rows)
  const status = rows.some((row) => row.reviewState !== "approved") ? "needs_review" : "staged"

  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(csvImports)
      .values({
        columnMapping: input.parsed.columnMapping,
        delimiter: input.parsed.delimiter,
        duplicateOfImportId: null,
        encoding: input.parsed.encoding,
        fileHash: input.parsed.fileHash,
        filename: input.filename,
        headerRow: input.parsed.headerRow,
        organizationId,
        rowCount: rows.length,
        status,
        uploadedAt: new Date(),
      })
      .returning()

    const stagedRows = rows.length
      ? await tx
          .insert(csvStagedRows)
          .values(
            rows.map((row) => ({
              confidence: row.confidence,
              currency: row.currency,
              duplicate: row.duplicate,
              importId: created.id,
              parsedAmount: row.parsedAmount,
              parsedDate: row.parsedDate,
              rawAmount: row.rawAmount,
              rawDate: row.rawDate,
              rawDescription: row.rawDescription,
              reviewState: row.reviewState,
              suggestionModel: row.suggestionModel,
              suggestionSource: row.suggestionSource,
              suggestedCategoryId: row.suggestedCategoryId,
              suggestedDepartmentId: row.suggestedDepartmentId,
              suggestedSubcategoryId: row.suggestedSubcategoryId,
              validationIssues: row.validationIssues,
            }))
          )
          .returning()
      : []

    await tx.insert(auditLogs).values({
      action: "csv_import.create",
      actorId: context.user.id,
      entityId: created.id,
      entityType: "csv_import",
      metadata: { filename: input.filename, rowCount: rows.length, status },
      organizationId,
    })

    return { import: created, stagedRows }
  })

  return {
    import: toCsvImport(result.import),
    stagedRows: result.stagedRows.map(toCsvStagedRow),
  }
}

export async function updateStagedRow(context: AuthOrganizationContext, importId: string, rowId: string, input: UpdateStagedRowInput) {
  const organizationId = context.organization.id
  const before = await getStagedRowForImport(organizationId, importId, rowId)

  if (!before) {
    throw new NotFoundError("Staged row not found")
  }

  const nextParsedDate = input.parsedDate === undefined ? before.parsedDate : input.parsedDate
  const nextParsedAmount = input.parsedAmount === undefined ? before.parsedAmount : input.parsedAmount
  const nextCurrency = input.currency === undefined ? before.currency : input.currency
  const nextDepartmentId = input.suggestedDepartmentId === undefined ? before.suggestedDepartmentId : input.suggestedDepartmentId
  const nextCategoryId = input.suggestedCategoryId === undefined ? before.suggestedCategoryId : input.suggestedCategoryId
  const existingDuplicate = await transactionDuplicateExists(organizationId, {
    parsedAmount: nextParsedAmount,
    parsedDate: nextParsedDate,
    rawDescription: before.rawDescription,
  })
  const nextDuplicate = existingDuplicate || (input.duplicate === undefined ? before.duplicate : input.duplicate)
  const recalculatedIssues = validationIssuesForRow({
    currency: nextCurrency,
    duplicate: nextDuplicate,
    parsedAmount: nextParsedAmount,
    parsedDate: nextParsedDate,
    rawDescription: before.rawDescription,
    suggestedCategoryId: nextCategoryId,
    suggestedDepartmentId: nextDepartmentId,
  })
  const nextIssues = recalculatedIssues
  const nextReviewState = input.reviewState === "approved" && nextIssues.length > 0
    ? "blocked"
    : input.reviewState ?? (nextIssues.length > 0 ? "blocked" : before.reviewState === "blocked" ? "needs_human" : before.reviewState)
  const manuallyCorrected = Object.keys(input).some((key) => key !== "reviewState")

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(csvStagedRows)
      .set({
        ...(input.currency === undefined ? {} : { currency: input.currency }),
        duplicate: nextDuplicate,
        ...(input.parsedAmount === undefined ? {} : { parsedAmount: input.parsedAmount }),
        ...(input.parsedDate === undefined ? {} : { parsedDate: input.parsedDate }),
        ...(nextReviewState === undefined ? {} : { reviewState: nextReviewState }),
        ...(manuallyCorrected ? { suggestionModel: null, suggestionSource: "manual" } : {}),
        ...(input.suggestedCategoryId === undefined ? {} : { suggestedCategoryId: input.suggestedCategoryId }),
        ...(input.suggestedDepartmentId === undefined ? {} : { suggestedDepartmentId: input.suggestedDepartmentId }),
        ...(input.suggestedSubcategoryId === undefined ? {} : { suggestedSubcategoryId: input.suggestedSubcategoryId }),
        ...(nextIssues === undefined ? {} : { validationIssues: nextIssues }),
        ...(nextReviewState === "approved" ? { duplicate: false } : {}),
        updatedAt: new Date(),
      })
      .where(eq(csvStagedRows.id, rowId))
      .returning()

    await tx.insert(auditLogs).values({
      action: "csv_staged_row.update",
      actorId: context.user.id,
      entityId: rowId,
      entityType: "csv_staged_row",
      metadata: { after: row, before },
      organizationId,
    })

    return [row]
  })

  return toCsvStagedRow(updated)
}

export async function commitImport(context: AuthOrganizationContext, importId: string) {
  const organizationId = context.organization.id
  const importRecord = await getImportForOrganization(organizationId, importId)

  if (!importRecord) throw new NotFoundError("Import not found")
  if (importRecord.status === "blocked_duplicate") throw new ConflictError("Duplicate import cannot be committed")
  if (importRecord.status === "committed") throw new ConflictError("Import is already committed")

  const rows = await db
    .select()
    .from(csvStagedRows)
    .where(eq(csvStagedRows.importId, importId))

  if (rows.length === 0) throw new UnprocessableError("Import has no staged rows")

  const uncommittableRows = rows.filter(
    (row) =>
      row.reviewState !== "approved" ||
      row.duplicate ||
      row.validationIssues.length > 0 ||
      !row.parsedDate ||
      !row.parsedAmount ||
      !row.currency ||
      !row.suggestedDepartmentId ||
      !row.suggestedCategoryId
  )

  if (uncommittableRows.length > 0) {
    throw new UnprocessableError("Resolve blocked and low-confidence rows before committing", {
      rowIds: uncommittableRows.map((row) => row.id),
    })
  }

  const departmentIds = Array.from(new Set(rows.map((row) => row.suggestedDepartmentId).filter((id): id is string => Boolean(id))))
  const categoryIds = Array.from(new Set(rows.map((row) => row.suggestedCategoryId).filter((id): id is string => Boolean(id))))

  const [validDepartments, validCategories] = await Promise.all([
    db.select({ id: departments.id }).from(departments).where(and(eq(departments.organizationId, organizationId), inArray(departments.id, departmentIds))),
    db.select({ id: categories.id, kind: categories.kind }).from(categories).where(and(eq(categories.organizationId, organizationId), inArray(categories.id, categoryIds))),
  ])

  if (validDepartments.length !== departmentIds.length) throw new UnprocessableError("One or more staged departments are invalid")
  if (validCategories.length !== categoryIds.length || validCategories.some((category) => category.kind !== "expense")) {
    throw new UnprocessableError("CSV expense imports require valid expense categories")
  }

  const committed = await db.transaction(async (tx) => {
    const createdTransactions = await tx
      .insert(transactions)
      .values(
        rows.map((row) => ({
          amount: row.parsedAmount!,
          attachmentUrl: importAttachmentUrl(importId, importRecord.filename),
          categoryId: row.suggestedCategoryId!,
          clientId: null,
          createdBy: context.user.id,
          currency: row.currency!,
          date: row.parsedDate!,
          departmentId: row.suggestedDepartmentId!,
          description: row.rawDescription,
          fxRateToUsd: fxRateForCurrency(row.currency!),
          organizationId,
          recurring: false,
          source: "csv" as const,
          status: "active",
          subcategoryId: row.suggestedSubcategoryId,
          type: "expense" as const,
          vendor: row.rawDescription,
        }))
      )
      .returning()

    const [updatedImport] = await tx
      .update(csvImports)
      .set({ status: "committed", updatedAt: new Date() })
      .where(and(eq(csvImports.organizationId, organizationId), eq(csvImports.id, importId)))
      .returning()

    await tx.insert(auditLogs).values({
      action: "csv_import.commit",
      actorId: context.user.id,
      entityId: importId,
      entityType: "csv_import",
      metadata: { transactionIds: createdTransactions.map((row) => row.id) },
      organizationId,
    })

    return { import: updatedImport, transactions: createdTransactions }
  })

  return {
    import: toCsvImport(committed.import),
    transactions: committed.transactions.map(toTransaction),
  }
}

export async function reverseImport(context: AuthOrganizationContext, importId: string) {
  const organizationId = context.organization.id
  const importRecord = await getImportForOrganization(organizationId, importId)

  if (!importRecord) throw new NotFoundError("Import not found")
  if (importRecord.status !== "committed") throw new UnprocessableError("Only committed imports can be reversed")

  const reversed = await db.transaction(async (tx) => {
    const reversedTransactions = await tx
      .update(transactions)
      .set({ status: "reversed", updatedAt: new Date() })
      .where(
        and(
          eq(transactions.organizationId, organizationId),
          eq(transactions.source, "csv"),
          eq(transactions.status, "active"),
          eq(transactions.attachmentUrl, importAttachmentUrl(importId, importRecord.filename))
        )
      )
      .returning()

    const [updatedImport] = await tx
      .update(csvImports)
      .set({ status: "needs_review", updatedAt: new Date() })
      .where(and(eq(csvImports.organizationId, organizationId), eq(csvImports.id, importId)))
      .returning()

    await tx.insert(auditLogs).values({
      action: "csv_import.reverse",
      actorId: context.user.id,
      entityId: importId,
      entityType: "csv_import",
      metadata: { transactionIds: reversedTransactions.map((row) => row.id) },
      organizationId,
    })

    return { import: updatedImport, transactions: reversedTransactions }
  })

  return {
    import: toCsvImport(reversed.import),
    transactions: reversed.transactions.map(toTransaction),
  }
}
