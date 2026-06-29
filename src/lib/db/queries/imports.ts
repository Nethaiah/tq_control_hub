import { and, asc, desc, eq } from "drizzle-orm"

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

export async function listStagedRows(organizationId: string, importId: string) {
  const rows = await db
    .select({ stagedRow: csvStagedRows })
    .from(csvStagedRows)
    .innerJoin(csvImports, eq(csvStagedRows.importId, csvImports.id))
    .where(and(eq(csvImports.organizationId, organizationId), eq(csvStagedRows.importId, importId)))
    .orderBy(asc(csvStagedRows.createdAt))

  return rows.map((row) => toCsvStagedRow(row.stagedRow))
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
