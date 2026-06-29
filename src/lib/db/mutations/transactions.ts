import { and, count, eq, inArray } from "drizzle-orm"

import type { AuthOrganizationContext } from "@/lib/api/auth"
import { NotFoundError, UnprocessableError } from "@/lib/api/errors"
import type { Transaction } from "@/domain/types"

import { db } from "../index"
import {
  auditLogs,
  categories,
  departments,
  transactionRevisions,
  transactions,
} from "../schema"

export type CreateTransactionInput = {
  amount: number
  attachmentUrl?: string | null
  categoryId: string
  clientId?: string | null
  currency: "USD" | "AED"
  date: string
  departmentId: string
  description: string
  fxRateToUsd?: number
  recurring?: boolean
  source?: "manual" | "csv" | "automation"
  subcategoryId?: string | null
  type: "revenue" | "expense"
  vendor?: string | null
}

export type UpdateTransactionInput = Partial<{
  amount: number
  attachmentUrl: string | null
  categoryId: string
  clientId: string | null
  currency: "USD" | "AED"
  date: string
  departmentId: string
  description: string
  fxRateToUsd: number
  recurring: boolean
  source: "manual" | "csv" | "automation"
  subcategoryId: string | null
  type: "revenue" | "expense"
  vendor: string | null
}>

export type BulkUpdateTransactionsInput = {
  categoryId: string
  departmentId: string
  ids: string[]
  subcategoryId?: string | null
}

function fxRateForCurrency(currency: "USD" | "AED", fxRateToUsd?: number) {
  if (fxRateToUsd && fxRateToUsd > 0) {
    return fxRateToUsd
  }

  return currency === "AED" ? 0.2723 : 1
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

async function assertDepartmentInOrganization(organizationId: string, departmentId: string) {
  const [department] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.organizationId, organizationId), eq(departments.id, departmentId)))
    .limit(1)

  if (!department) {
    throw new UnprocessableError("Department does not belong to this organization")
  }
}

async function assertCategoryInOrganization(organizationId: string, categoryId: string, type?: "revenue" | "expense") {
  const [category] = await db
    .select({ id: categories.id, kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.organizationId, organizationId), eq(categories.id, categoryId)))
    .limit(1)

  if (!category) {
    throw new UnprocessableError("Category does not belong to this organization")
  }

  if (type && category.kind !== type) {
    throw new UnprocessableError("Category kind must match the transaction type")
  }

  return category
}

async function assertSubcategoryInOrganization(organizationId: string, subcategoryId: string | null | undefined) {
  if (!subcategoryId) return

  const [subcategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.organizationId, organizationId), eq(categories.id, subcategoryId)))
    .limit(1)

  if (!subcategory) {
    throw new UnprocessableError("Subcategory does not belong to this organization")
  }
}

async function nextRevisionNumber(transactionId: string) {
  const [revisionCount] = await db
    .select({ count: count() })
    .from(transactionRevisions)
    .where(eq(transactionRevisions.transactionId, transactionId))

  return Number(revisionCount?.count ?? 0) + 1
}

export async function createTransaction(context: AuthOrganizationContext, input: CreateTransactionInput) {
  const organizationId = context.organization.id

  await assertDepartmentInOrganization(organizationId, input.departmentId)
  await assertCategoryInOrganization(organizationId, input.categoryId, input.type)
  await assertSubcategoryInOrganization(organizationId, input.subcategoryId)

  const [created] = await db
    .insert(transactions)
    .values({
      amount: input.amount,
      attachmentUrl: input.attachmentUrl ?? null,
      categoryId: input.categoryId,
      clientId: input.type === "revenue" ? (input.clientId ?? null) : null,
      createdBy: context.user.id,
      currency: input.currency,
      date: input.date,
      departmentId: input.departmentId,
      description: input.description,
      fxRateToUsd: fxRateForCurrency(input.currency, input.fxRateToUsd),
      organizationId,
      recurring: input.recurring ?? false,
      source: input.source ?? "manual",
      status: "active",
      subcategoryId: input.subcategoryId ?? null,
      type: input.type,
      vendor: input.type === "expense" ? (input.vendor ?? null) : null,
    })
    .returning()

  await db.insert(auditLogs).values({
    action: "transaction.create",
    actorId: context.user.id,
    entityId: created.id,
    entityType: "transaction",
    metadata: { after: created },
    organizationId,
  })

  return toTransaction(created)
}

export async function updateTransaction(context: AuthOrganizationContext, id: string, input: UpdateTransactionInput) {
  const organizationId = context.organization.id
  const [before] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.organizationId, organizationId), eq(transactions.id, id), eq(transactions.status, "active")))
    .limit(1)

  if (!before) {
    throw new NotFoundError("Transaction not found")
  }

  const nextType = input.type ?? before.type
  const nextCategoryId = input.categoryId ?? before.categoryId

  if (input.departmentId) await assertDepartmentInOrganization(organizationId, input.departmentId)
  if (input.categoryId || input.type) await assertCategoryInOrganization(organizationId, nextCategoryId, nextType)
  if ("subcategoryId" in input) await assertSubcategoryInOrganization(organizationId, input.subcategoryId)

  const updateValues = {
    ...input,
    clientId: nextType === "revenue" ? (input.clientId === undefined ? before.clientId : input.clientId) : null,
    fxRateToUsd: input.currency ? fxRateForCurrency(input.currency, input.fxRateToUsd) : input.fxRateToUsd,
    updatedAt: new Date(),
    vendor: nextType === "expense" ? (input.vendor === undefined ? before.vendor : input.vendor) : null,
  }

  const [after] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(transactions)
      .set(updateValues)
      .where(and(eq(transactions.organizationId, organizationId), eq(transactions.id, id)))
      .returning()

    await tx.insert(transactionRevisions).values({
      after: updated,
      before,
      changedBy: context.user.id,
      organizationId,
      revision: await nextRevisionNumber(id),
      transactionId: id,
    })

    await tx.insert(auditLogs).values({
      action: "transaction.update",
      actorId: context.user.id,
      entityId: id,
      entityType: "transaction",
      metadata: { after: updated, before },
      organizationId,
    })

    return [updated]
  })

  return toTransaction(after)
}

export async function bulkUpdateTransactions(context: AuthOrganizationContext, input: BulkUpdateTransactionsInput) {
  const organizationId = context.organization.id
  const ids = [...new Set(input.ids)]

  if (ids.length === 0) {
    throw new UnprocessableError("Select at least one transaction")
  }

  await assertDepartmentInOrganization(organizationId, input.departmentId)
  const targetCategory = await assertCategoryInOrganization(organizationId, input.categoryId)
  await assertSubcategoryInOrganization(organizationId, input.subcategoryId)

  const beforeRows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.organizationId, organizationId), eq(transactions.status, "active"), inArray(transactions.id, ids)))

  if (beforeRows.length !== ids.length) {
    throw new NotFoundError("One or more transactions were not found")
  }

  if (beforeRows.some((row) => row.type !== targetCategory.kind)) {
    throw new UnprocessableError("Bulk category kind must match all selected transaction types")
  }

  const updatedRows = await db.transaction(async (tx) => {
    const rows = await tx
      .update(transactions)
      .set({
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        subcategoryId: input.subcategoryId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.organizationId, organizationId), inArray(transactions.id, ids)))
      .returning()

    for (const before of beforeRows) {
      const after = rows.find((row) => row.id === before.id)
      if (!after) continue

      await tx.insert(transactionRevisions).values({
        after,
        before,
        changedBy: context.user.id,
        organizationId,
        revision: await nextRevisionNumber(before.id),
        transactionId: before.id,
      })
    }

    await tx.insert(auditLogs).values({
      action: "transaction.bulk_update",
      actorId: context.user.id,
      entityId: ids.join(","),
      entityType: "transaction",
      metadata: {
        afterIds: rows.map((row) => row.id),
        beforeIds: beforeRows.map((row) => row.id),
        patch: {
          categoryId: input.categoryId,
          departmentId: input.departmentId,
          subcategoryId: input.subcategoryId ?? null,
        },
      },
      organizationId,
    })

    return rows
  })

  return updatedRows.map(toTransaction)
}
