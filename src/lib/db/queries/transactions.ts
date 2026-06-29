import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, sum, type Column, type SQL } from "drizzle-orm"

import type { AuthOrganizationContext } from "@/lib/api/auth"
import type { MetricsFilter, TransactionFilter } from "@/lib/api/filters"
import type { Transaction } from "@/domain/types"

export type LedgerFilterInput = MetricsFilter | TransactionFilter

import { db } from "../index"
import { categories, clients, departments, transactions } from "../schema"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type LedgerTotals = {
  revenueUsd: number
  expenseUsd: number
  netProfitUsd: number
  rowCount: number
  transactionIds: string[]
}

export type LedgerPagination = {
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
}

export type LedgerData = {
  categories: Array<typeof categories.$inferSelect>
  clients: Array<typeof clients.$inferSelect>
  departments: Array<typeof departments.$inferSelect>
  rows: Transaction[]
  totals: LedgerTotals
  pagination: LedgerPagination
}

function isUuid(value: string | undefined) {
  return Boolean(value && UUID_PATTERN.test(value))
}

export function splitIds(ids: string | undefined) {
  return ids?.split(",").map((id) => id.trim()).filter(isUuid) ?? []
}

export function baseTransactionConditions(context: AuthOrganizationContext) {
  const conditions: SQL[] = [
    eq(transactions.organizationId, context.organization.id),
    eq(transactions.status, "active"),
  ]

  if (context.membership?.role !== "owner") {
    if (context.departmentIds.length > 0) {
      conditions.push(inArray(transactions.departmentId, context.departmentIds))
    } else {
      conditions.push(sql`false`)
    }
  }

  return conditions
}

export function transactionFilterConditions<T extends LedgerFilterInput>(filters: T) {
  const conditions: SQL[] = []
  const ids = splitIds(filters.ids)
  const clientOrVendor = filters.clientOrVendor?.trim()
  const search = filters.search?.trim()

  if (ids.length > 0) conditions.push(inArray(transactions.id, ids))
  if (filters.from) conditions.push(gte(transactions.date, filters.from))
  if (filters.to) conditions.push(lte(transactions.date, filters.to))
  if (filters.type) conditions.push(eq(transactions.type, filters.type))
  if (isUuid(filters.departmentId)) conditions.push(eq(transactions.departmentId, filters.departmentId!))
  if (isUuid(filters.categoryId)) {
    conditions.push(
      or(eq(transactions.categoryId, filters.categoryId!), eq(transactions.subcategoryId, filters.categoryId!))!
    )
  }
  if (filters.source) conditions.push(eq(transactions.source, filters.source))
  if (("recurring" in filters) && filters.recurring !== undefined) {
    conditions.push(eq(transactions.recurring, filters.recurring))
  }

  if (clientOrVendor) {
    const clientVendorConditions: SQL[] = [
      ilike(transactions.vendor, clientOrVendor),
      ilike(clients.name, clientOrVendor),
    ]

    if (isUuid(clientOrVendor)) {
      clientVendorConditions.push(eq(transactions.clientId, clientOrVendor))
    }

    conditions.push(or(...clientVendorConditions)!)
  }

  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(ilike(transactions.description, pattern), ilike(transactions.vendor, pattern), ilike(clients.name, pattern))!
    )
  }

  return conditions
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

const sortableColumns: Record<string, Column | SQL> = {
  amount: transactions.amount,
  category: categories.name,
  date: transactions.date,
  department: departments.name,
  description: transactions.description,
  recurring: transactions.recurring,
  source: transactions.source,
  type: transactions.type,
}

export async function listLedgerData(context: AuthOrganizationContext, filters: TransactionFilter): Promise<LedgerData> {
  const conditions = [...baseTransactionConditions(context), ...transactionFilterConditions(filters)]
  const whereClause = and(...conditions)
  const organizationId = context.organization.id
  const page = filters.page
  const pageSize = filters.pageSize
  const offset = (page - 1) * pageSize

  const departmentConditions: SQL[] = [eq(departments.organizationId, organizationId)]

  if (context.membership?.role !== "owner") {
    if (context.departmentIds.length > 0) {
      departmentConditions.push(inArray(departments.id, context.departmentIds))
    } else {
      departmentConditions.push(sql`false`)
    }
  }

  const sortBy = filters.sortBy ?? "date"
  const sortDir = filters.sortDir ?? "desc"
  const sortColumn = sortableColumns[sortBy] ?? transactions.date
  const orderBy = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn)

  const [aggregateResult, pageRows, departmentRows, categoryRows, allClientRows] = await Promise.all([    db
      .select({
        expenseUsd: sum(sql`CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} * ${transactions.fxRateToUsd} ELSE 0 END`),
        revenueUsd: sum(sql`CASE WHEN ${transactions.type} = 'revenue' THEN ${transactions.amount} * ${transactions.fxRateToUsd} ELSE 0 END`),
        rowCount: count(),
      })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(whereClause),
    db
      .select({ transaction: transactions })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .leftJoin(departments, eq(transactions.departmentId, departments.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(whereClause)
      .orderBy(orderBy, desc(transactions.date))
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
      .orderBy(asc(categories.kind), asc(categories.name)),
    context.membership?.role === "owner"
      ? db
          .select()
          .from(clients)
          .where(eq(clients.organizationId, organizationId))
          .orderBy(asc(clients.name))
      : Promise.resolve([]),
  ])

  const agg = aggregateResult[0]
  const revenueUsd = Number(agg?.revenueUsd ?? 0)
  const expenseUsd = Number(agg?.expenseUsd ?? 0)
  const totalRows = Number(agg?.rowCount ?? 0)

  const rows = pageRows.map((row) => toTransaction(row.transaction))

  const clientIds = Array.from(new Set(rows.map((row) => row.clientId).filter((id): id is string => Boolean(id))))
  const scopedClientRows = clientIds.length
    ? await db
        .select()
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), inArray(clients.id, clientIds)))
        .orderBy(asc(clients.name))
    : []

  const clientRows = context.membership?.role === "owner" ? allClientRows : scopedClientRows

  return {
    categories: categoryRows,
    clients: clientRows,
    departments: departmentRows,
    pagination: {
      page,
      pageSize,
      totalPages: Math.ceil(totalRows / pageSize),
      totalRows,
    },
    rows,
    totals: {
      expenseUsd,
      netProfitUsd: revenueUsd - expenseUsd,
      revenueUsd,
      rowCount: totalRows,
      transactionIds: [],
    },
  }
}

export async function getTransactionForOrganization(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.organizationId, organizationId), eq(transactions.id, id), eq(transactions.status, "active")))
    .limit(1)

  return row ?? null
}
