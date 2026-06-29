import { and, asc, count, desc, eq, ilike, inArray, or, sql, type Column, type SQL } from "drizzle-orm"

import type { Category, Client, Department, RecurringItem } from "@/domain/types"
import type { AuthOrganizationContext } from "@/lib/api/auth"

import { db } from "../index"
import { categories, clients, departments, recurringItems } from "../schema"

export type RecurringItemsData = {
  categories: Category[]
  clients: Client[]
  departments: Department[]
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
  recurringItems: RecurringItem[]
}

export type RecurringItemsFilter = {
  categoryId?: string
  departmentId?: string
  page: number
  pageSize: number
  search?: string
  sortBy?: "template" | "amount" | "classification" | "schedule"
  sortDir?: "asc" | "desc"
  type?: "revenue" | "expense"
}

export function toRecurringItem(row: typeof recurringItems.$inferSelect): RecurringItem {
  return {
    amount: row.amount,
    cadence: row.cadence,
    categoryId: row.categoryId,
    clientId: row.clientId,
    currency: row.currency,
    departmentId: row.departmentId,
    fxRateToUsd: row.fxRateToUsd,
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    nextRun: row.nextRun,
    subcategoryId: row.subcategoryId,
    template: row.template,
    type: row.type,
    vendor: row.vendor,
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

function toCategory(row: typeof categories.$inferSelect): Category {
  return {
    archived: row.archived,
    id: row.id,
    kind: row.kind,
    name: row.name,
    parentId: row.parentId,
  }
}

function toClient(row: typeof clients.$inferSelect): Client {
  return {
    id: row.id,
    mrrUsd: row.mrrUsd,
    name: row.name,
    startDate: row.startDate,
    status: row.status,
  }
}

const sortableColumns: Record<NonNullable<RecurringItemsFilter["sortBy"]>, Column | SQL> = {
  amount: recurringItems.amount,
  classification: departments.name,
  schedule: recurringItems.nextRun,
  template: recurringItems.template,
}

export async function listRecurringItemsData(
  context: AuthOrganizationContext,
  filters: RecurringItemsFilter
): Promise<RecurringItemsData> {
  const organizationId = context.organization.id
  const recurringConditions: SQL[] = [eq(recurringItems.organizationId, organizationId), eq(recurringItems.active, true)]
  const departmentConditions: SQL[] = [eq(departments.organizationId, organizationId)]
  const page = filters.page
  const pageSize = filters.pageSize
  const offset = (page - 1) * pageSize

  if (filters.type) recurringConditions.push(eq(recurringItems.type, filters.type))
  if (filters.departmentId) recurringConditions.push(eq(recurringItems.departmentId, filters.departmentId))
  if (filters.categoryId) {
    recurringConditions.push(
      or(eq(recurringItems.categoryId, filters.categoryId), eq(recurringItems.subcategoryId, filters.categoryId))!
    )
  }

  if (filters.search?.trim()) {
    const pattern = `%${filters.search.trim()}%`
    recurringConditions.push(
      or(
        ilike(recurringItems.template, pattern),
        ilike(recurringItems.idempotencyKey, pattern),
        ilike(recurringItems.vendor, pattern),
        ilike(departments.name, pattern),
        ilike(categories.name, pattern),
        ilike(clients.name, pattern)
      )!
    )
  }

  if (context.membership?.role !== "owner") {
    if (context.departmentIds.length > 0) {
      recurringConditions.push(inArray(recurringItems.departmentId, context.departmentIds))
      departmentConditions.push(inArray(departments.id, context.departmentIds))
    } else {
      recurringConditions.push(sql`false`)
      departmentConditions.push(sql`false`)
    }
  }

  const sortBy = filters.sortBy ?? "schedule"
  const sortDir = filters.sortDir ?? "asc"
  const sortColumn = sortableColumns[sortBy] ?? recurringItems.nextRun
  const orderBy = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn)
  const whereClause = and(...recurringConditions)

  const [totalRowsResult, recurringRows, departmentRows, categoryRows, clientRows] = await Promise.all([
    db
      .select({ rowCount: count() })
      .from(recurringItems)
      .leftJoin(departments, eq(recurringItems.departmentId, departments.id))
      .leftJoin(categories, eq(recurringItems.categoryId, categories.id))
      .leftJoin(clients, eq(recurringItems.clientId, clients.id))
      .where(whereClause),
    db
      .select({ recurringItem: recurringItems })
      .from(recurringItems)
      .leftJoin(departments, eq(recurringItems.departmentId, departments.id))
      .leftJoin(categories, eq(recurringItems.categoryId, categories.id))
      .leftJoin(clients, eq(recurringItems.clientId, clients.id))
      .where(whereClause)
      .orderBy(orderBy, asc(recurringItems.template))
      .limit(pageSize)
      .offset(offset),
    db
      .select()
      .from(departments)
      .where(and(...departmentConditions))
      .orderBy(asc(departments.name)),
    db
      .select()
      .from(categories)
      .where(eq(categories.organizationId, organizationId))
      .orderBy(asc(categories.kind), asc(categories.parentId), asc(categories.name)),
    db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, organizationId))
      .orderBy(asc(clients.name)),
  ])

  const totalRows = Number(totalRowsResult[0]?.rowCount ?? 0)
  const recurringItemRows = recurringRows.map((row) => row.recurringItem)
  const visibleClientIds = new Set(recurringItemRows.map((row) => row.clientId).filter((id): id is string => Boolean(id)))
  const visibleClientRows = context.membership?.role === "owner"
    ? clientRows
    : clientRows.filter((row) => visibleClientIds.has(row.id))

  return {
    categories: categoryRows.map(toCategory),
    clients: visibleClientRows.map(toClient),
    departments: departmentRows.map(toDepartment),
    pagination: {
      page,
      pageSize,
      totalPages: Math.ceil(totalRows / pageSize),
      totalRows,
    },
    recurringItems: recurringItemRows.map(toRecurringItem),
  }
}

export async function getRecurringItemForOrganization(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(recurringItems)
    .where(and(eq(recurringItems.organizationId, organizationId), eq(recurringItems.id, id)))
    .limit(1)

  return row ?? null
}
