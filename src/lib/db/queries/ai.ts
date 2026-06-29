import { and, desc, eq, inArray, sql } from "drizzle-orm"

import type { AiSuggestion } from "@/domain/types"
import type { AuthOrganizationContext } from "@/lib/api/auth"
import type { MetricsFilter } from "@/lib/api/filters"

import { db } from "../index"
import { aiSuggestions, categories, clients, departments, transactions } from "../schema"
import { baseTransactionConditions, transactionFilterConditions } from "./transactions"

export type AiQueryBreakdownRow = {
  amount: number
  category: string
  transactionIds: string[]
}

export type AiLedgerQueryResult = {
  breakdown: AiQueryBreakdownRow[]
  sourceRows: Array<{
    amountUsd: number
    category: string | null
    clientOrVendor: string | null
    date: string
    department: string | null
    description: string
    id: string
    type: "revenue" | "expense"
  }>
  totals: {
    expenseUsd: number
    netProfitUsd: number
    revenueUsd: number
    rowCount: number
    transactionIds: string[]
  }
}

export type AiLedgerDateCoverage = {
  from: string | null
  to: string | null
}

export type AiQueryLookups = {
  categories: Array<typeof categories.$inferSelect>
  clients: Array<typeof clients.$inferSelect>
  departments: Array<typeof departments.$inferSelect>
}

export function toAiSuggestion(row: typeof aiSuggestions.$inferSelect): AiSuggestion {
  return {
    confidence: row.confidence,
    feature: row.feature,
    filterQuery: row.filterQuery,
    id: row.id,
    proposedAction: row.proposedAction,
    reviewState: row.reviewState,
    summary: row.summary,
    title: row.title,
    transactionIds: row.transactionIds,
  }
}

export function filtersToQueryString(filters: MetricsFilter, transactionIds?: string[]) {
  const params = new URLSearchParams()
  const ids = transactionIds?.length ? transactionIds.join(",") : filters.ids

  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  if (filters.type) params.set("type", filters.type)
  if (filters.departmentId) params.set("departmentId", filters.departmentId)
  if (filters.categoryId) params.set("categoryId", filters.categoryId)
  if (filters.clientOrVendor) params.set("clientOrVendor", filters.clientOrVendor)
  if (filters.search) params.set("search", filters.search)
  if (filters.source) params.set("source", filters.source)
  if (ids) params.set("ids", ids)

  return params.toString()
}

export async function listAiSuggestions(context: AuthOrganizationContext) {
  const rows = await db
    .select()
    .from(aiSuggestions)
    .where(eq(aiSuggestions.organizationId, context.organization.id))
    .orderBy(desc(aiSuggestions.createdAt))

  const suggestions = rows.map(toAiSuggestion)

  if (context.membership?.role === "owner") {
    return suggestions
  }

  if (context.departmentIds.length === 0) {
    return []
  }

  const allowedRows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.organizationId, context.organization.id),
        eq(transactions.status, "active"),
        inArray(transactions.departmentId, context.departmentIds)
      )
    )

  const allowedIds = new Set(allowedRows.map((row) => row.id))

  return suggestions.filter(
    (suggestion) =>
      suggestion.transactionIds.length > 0 && suggestion.transactionIds.every((id) => allowedIds.has(id))
  )
}

export async function getAiSuggestionForOrganization(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.organizationId, organizationId), eq(aiSuggestions.id, id)))
    .limit(1)

  return row ? toAiSuggestion(row) : null
}

export async function loadAiQueryLookups(context: AuthOrganizationContext): Promise<AiQueryLookups> {
  const organizationId = context.organization.id
  const departmentConditions = [eq(departments.organizationId, organizationId)]

  if (context.membership?.role !== "owner") {
    if (context.departmentIds.length > 0) {
      departmentConditions.push(inArray(departments.id, context.departmentIds))
    } else {
      departmentConditions.push(sql`false`)
    }
  }

  const [departmentRows, categoryRows, clientRows] = await Promise.all([
    db.select().from(departments).where(and(...departmentConditions)),
    db.select().from(categories).where(eq(categories.organizationId, organizationId)),
    context.membership?.role === "owner"
      ? db.select().from(clients).where(eq(clients.organizationId, organizationId))
      : Promise.resolve([]),
  ])

  return {
    categories: categoryRows,
    clients: clientRows,
    departments: departmentRows,
  }
}

export async function runAiLedgerQuery(context: AuthOrganizationContext, filters: MetricsFilter): Promise<AiLedgerQueryResult> {
  const conditions = [...baseTransactionConditions(context), ...transactionFilterConditions(filters)]
  const rows = await db
    .select({
      amount: transactions.amount,
      categoryName: categories.name,
      clientName: clients.name,
      date: transactions.date,
      departmentName: departments.name,
      description: transactions.description,
      fxRateToUsd: transactions.fxRateToUsd,
      id: transactions.id,
      type: transactions.type,
      vendor: transactions.vendor,
    })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .leftJoin(departments, eq(transactions.departmentId, departments.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...conditions))

  const transactionIds = rows.map((row) => row.id)
  const revenueUsd = rows.reduce(
    (total, row) => total + (row.type === "revenue" ? row.amount * row.fxRateToUsd : 0),
    0
  )
  const expenseUsd = rows.reduce(
    (total, row) => total + (row.type === "expense" ? row.amount * row.fxRateToUsd : 0),
    0
  )
  const breakdownByCategory = new Map<string, { amount: number; transactionIds: string[] }>()

  for (const row of rows) {
    const category = row.categoryName ?? "Uncategorized"
    const current = breakdownByCategory.get(category) ?? { amount: 0, transactionIds: [] }
    current.amount += row.amount * row.fxRateToUsd
    current.transactionIds.push(row.id)
    breakdownByCategory.set(category, current)
  }

  return {
    breakdown: Array.from(breakdownByCategory.entries())
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.amount - a.amount),
    sourceRows: rows.map((row) => ({
      amountUsd: row.amount * row.fxRateToUsd,
      category: row.categoryName,
      clientOrVendor: row.clientName ?? row.vendor,
      date: row.date,
      department: row.departmentName,
      description: row.description,
      id: row.id,
      type: row.type,
    })),
    totals: {
      expenseUsd,
      netProfitUsd: revenueUsd - expenseUsd,
      revenueUsd,
      rowCount: rows.length,
      transactionIds,
    },
  }
}

export async function getAiLedgerDateCoverage(context: AuthOrganizationContext): Promise<AiLedgerDateCoverage> {
  const conditions = baseTransactionConditions(context)
  const [coverage] = await db
    .select({
      from: sql<string | null>`min(${transactions.date})`,
      to: sql<string | null>`max(${transactions.date})`,
    })
    .from(transactions)
    .where(and(...conditions))

  return {
    from: coverage?.from ?? null,
    to: coverage?.to ?? null,
  }
}
