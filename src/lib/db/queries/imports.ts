import { and, asc, count, desc, eq, ilike, or, sql, type Column, type SQL } from "drizzle-orm"

import type { Category, CsvImport, CsvStagedRow, Department } from "@/domain/types"
import type { AuthOrganizationContext } from "@/lib/api/auth"

import { db } from "../index"
import { categories, csvImports, csvStagedRows, departments } from "../schema"
import { toCategory } from "./categories"

export type ImportsData = {
  categories: Category[]
  departments: Department[]
  imports: CsvImport[]
}

export type ImportDetailData = ImportsData & {
  activeImport: CsvImport | null
  stagedRows: CsvStagedRow[]
}

export type StagedRowsFilter = {
  page: number
  pageSize: number
  reviewState?: "approved" | "needs_human" | "blocked"
  search?: string
  sortBy?: "rawDate" | "rawDescription" | "rawAmount" | "suggestion" | "confidence" | "suggestionSource" | "validation" | "reviewState"
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

function toDepartment(row: typeof departments.$inferSelect): Department {
  return {
    color: row.color,
    id: row.id,
    monthlyBudgetUsd: row.monthlyBudgetUsd,
    name: row.name,
  }
}

export function toCsvImport(row: typeof csvImports.$inferSelect): CsvImport {
  return {
    columnMapping: row.columnMapping,
    delimiter: row.delimiter,
    duplicateOfImportId: row.duplicateOfImportId,
    encoding: row.encoding,
    fileHash: row.fileHash,
    filename: row.filename,
    headerRow: row.headerRow,
    id: row.id,
    rowCount: row.rowCount,
    status: row.status,
    uploadedAt: row.uploadedAt.toISOString(),
  }
}

export function toCsvStagedRow(row: typeof csvStagedRows.$inferSelect): CsvStagedRow {
  return {
    confidence: row.confidence,
    currency: row.currency,
    duplicate: row.duplicate,
    id: row.id,
    importId: row.importId,
    parsedAmount: row.parsedAmount,
    parsedDate: row.parsedDate,
    rawAmount: row.rawAmount,
    rawDate: row.rawDate,
    rawDescription: row.rawDescription,
    reviewState: row.reviewState,
    suggestionModel: row.suggestionModel,
    suggestionSource: row.suggestionSource as CsvStagedRow["suggestionSource"],
    suggestedCategoryId: row.suggestedCategoryId,
    suggestedDepartmentId: row.suggestedDepartmentId,
    suggestedSubcategoryId: row.suggestedSubcategoryId,
    validationIssues: row.validationIssues,
  }
}

export async function listImportsData(context: AuthOrganizationContext): Promise<ImportsData> {
  const organizationId = context.organization.id
  const [importRows, departmentRows, categoryRows] = await Promise.all([
    db
      .select()
      .from(csvImports)
      .where(eq(csvImports.organizationId, organizationId))
      .orderBy(desc(csvImports.uploadedAt)),
    db
      .select()
      .from(departments)
      .where(eq(departments.organizationId, organizationId))
      .orderBy(asc(departments.name)),
    db
      .select()
      .from(categories)
      .where(eq(categories.organizationId, organizationId))
      .orderBy(asc(categories.kind), asc(categories.parentId), asc(categories.name)),
  ])

  return {
    categories: categoryRows.map(toCategory),
    departments: departmentRows.map(toDepartment),
    imports: importRows.map(toCsvImport),
  }
}

export async function getImportForOrganization(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(csvImports)
    .where(and(eq(csvImports.organizationId, organizationId), eq(csvImports.id, id)))
    .limit(1)

  return row ?? null
}

export async function getImportDetailData(context: AuthOrganizationContext, importId: string): Promise<ImportDetailData> {
  const [importsData, activeImport, stagedRows] = await Promise.all([
    listImportsData(context),
    getImportForOrganization(context.organization.id, importId),
    listStagedRows(context.organization.id, importId),
  ])

  return {
    ...importsData,
    activeImport: activeImport ? toCsvImport(activeImport) : null,
    stagedRows,
  }
}

const stagedSortColumns: Record<NonNullable<StagedRowsFilter["sortBy"]>, Column | SQL> = {
  confidence: csvStagedRows.confidence,
  rawAmount: csvStagedRows.rawAmount,
  rawDate: csvStagedRows.rawDate,
  rawDescription: csvStagedRows.rawDescription,
  reviewState: csvStagedRows.reviewState,
  suggestion: sql`concat(coalesce(${departments.name}, ''), ' ', coalesce(${categories.name}, ''))`,
  suggestionSource: csvStagedRows.suggestionSource,
  validation: sql`${csvStagedRows.validationIssues}::text`,
}

function stagedRowsBaseConditions(organizationId: string, importId: string) {
  return [eq(csvImports.organizationId, organizationId), eq(csvStagedRows.importId, importId)]
}

function committableStagedRowsConditions(organizationId: string, importId: string) {
  return [
    ...stagedRowsBaseConditions(organizationId, importId),
    eq(csvStagedRows.reviewState, "approved"),
    eq(csvStagedRows.duplicate, false),
    sql`jsonb_array_length(${csvStagedRows.validationIssues}) = 0`,
    sql`${csvStagedRows.parsedDate} is not null`,
    sql`${csvStagedRows.parsedAmount} is not null`,
    sql`${csvStagedRows.currency} is not null`,
    sql`${csvStagedRows.suggestedDepartmentId} is not null`,
    sql`${csvStagedRows.suggestedCategoryId} is not null`,
  ]
}

export async function listStagedRowsData(
  organizationId: string,
  importId: string,
  filters: StagedRowsFilter
): Promise<StagedRowsData> {
  const page = filters.page
  const pageSize = filters.pageSize
  const offset = (page - 1) * pageSize
  const conditions: SQL[] = stagedRowsBaseConditions(organizationId, importId)

  if (filters.reviewState) conditions.push(eq(csvStagedRows.reviewState, filters.reviewState))

  if (filters.search?.trim()) {
    const pattern = `%${filters.search.trim()}%`
    conditions.push(
      or(
        ilike(csvStagedRows.rawDate, pattern),
        ilike(csvStagedRows.rawDescription, pattern),
        ilike(csvStagedRows.rawAmount, pattern),
        ilike(csvStagedRows.suggestionSource, pattern),
        ilike(csvStagedRows.suggestionModel, pattern),
        ilike(departments.name, pattern),
        ilike(categories.name, pattern),
        sql`${csvStagedRows.reviewState}::text ilike ${pattern}`,
        sql`${csvStagedRows.validationIssues}::text ilike ${pattern}`,
        sql`${csvStagedRows.parsedDate}::text ilike ${pattern}`,
        sql`${csvStagedRows.parsedAmount}::text ilike ${pattern}`,
        sql`${csvStagedRows.currency}::text ilike ${pattern}`
      )!
    )
  }

  const sortBy = filters.sortBy ?? "rawDate"
  const sortDir = filters.sortDir ?? "asc"
  const sortColumn = stagedSortColumns[sortBy] ?? csvStagedRows.createdAt
  const orderBy = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn)
  const whereClause = and(...conditions)

  const [totalRowsResult, rowResults, approvedResult, lowConfidenceResult, blockedResult, committableResult] = await Promise.all([
    db
      .select({ rowCount: count() })
      .from(csvStagedRows)
      .innerJoin(csvImports, eq(csvStagedRows.importId, csvImports.id))
      .leftJoin(departments, eq(csvStagedRows.suggestedDepartmentId, departments.id))
      .leftJoin(categories, eq(csvStagedRows.suggestedCategoryId, categories.id))
      .where(whereClause),
    db
      .select({ stagedRow: csvStagedRows })
      .from(csvStagedRows)
      .innerJoin(csvImports, eq(csvStagedRows.importId, csvImports.id))
      .leftJoin(departments, eq(csvStagedRows.suggestedDepartmentId, departments.id))
      .leftJoin(categories, eq(csvStagedRows.suggestedCategoryId, categories.id))
      .where(whereClause)
      .orderBy(orderBy, asc(csvStagedRows.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ rowCount: count() })
      .from(csvStagedRows)
      .innerJoin(csvImports, eq(csvStagedRows.importId, csvImports.id))
      .where(and(...stagedRowsBaseConditions(organizationId, importId), eq(csvStagedRows.reviewState, "approved"))),
    db
      .select({ rowCount: count() })
      .from(csvStagedRows)
      .innerJoin(csvImports, eq(csvStagedRows.importId, csvImports.id))
      .where(and(...stagedRowsBaseConditions(organizationId, importId), eq(csvStagedRows.reviewState, "needs_human"))),
    db
      .select({ rowCount: count() })
      .from(csvStagedRows)
      .innerJoin(csvImports, eq(csvStagedRows.importId, csvImports.id))
      .where(and(...stagedRowsBaseConditions(organizationId, importId), eq(csvStagedRows.reviewState, "blocked"))),
    db
      .select({ rowCount: count() })
      .from(csvStagedRows)
      .innerJoin(csvImports, eq(csvStagedRows.importId, csvImports.id))
      .where(and(...committableStagedRowsConditions(organizationId, importId))),
  ])

  const totalRows = Number(totalRowsResult[0]?.rowCount ?? 0)

  return {
    pagination: {
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
      totalRows,
    },
    stagedRows: rowResults.map((row) => toCsvStagedRow(row.stagedRow)),
    summary: {
      approvedCount: Number(approvedResult[0]?.rowCount ?? 0),
      blockedCount: Number(blockedResult[0]?.rowCount ?? 0),
      committableCount: Number(committableResult[0]?.rowCount ?? 0),
      lowConfidenceCount: Number(lowConfidenceResult[0]?.rowCount ?? 0),
    },
  }
}

export async function listStagedRows(organizationId: string, importId: string) {
  const data = await listStagedRowsData(organizationId, importId, { page: 1, pageSize: 1000 })

  return data.stagedRows
}

export async function getStagedRowForImport(organizationId: string, importId: string, rowId: string) {
  const [row] = await db
    .select({ stagedRow: csvStagedRows })
    .from(csvStagedRows)
    .innerJoin(csvImports, eq(csvStagedRows.importId, csvImports.id))
    .where(and(eq(csvImports.organizationId, organizationId), eq(csvStagedRows.importId, importId), eq(csvStagedRows.id, rowId)))
    .limit(1)

  return row?.stagedRow ?? null
}
