import { and, eq } from "drizzle-orm"

import type { AuthOrganizationContext } from "@/lib/api/auth"
import { ConflictError, NotFoundError, UnprocessableError } from "@/lib/api/errors"

import { db } from "../index"
import { auditLogs, categories, clients, departments, recurringItems } from "../schema"
import { getRecurringItemForOrganization, toRecurringItem } from "../queries/recurring-items"

export type CreateRecurringItemInput = {
  amount: number
  cadence: "monthly" | "quarterly" | "annual"
  categoryId: string
  clientId?: string | null
  currency: "USD" | "AED"
  departmentId: string
  fxRateToUsd?: number
  idempotencyKey?: string
  nextRun: string
  subcategoryId?: string | null
  template: string
  type: "revenue" | "expense"
  vendor?: string | null
}

export type UpdateRecurringItemInput = Partial<CreateRecurringItemInput & { active: boolean }>

function fxRateForCurrency(currency: "USD" | "AED", fxRateToUsd?: number) {
  if (fxRateToUsd && fxRateToUsd > 0) {
    return fxRateToUsd
  }

  return currency === "AED" ? 0.2723 : 1
}

function idempotencyKeyFor(input: Pick<CreateRecurringItemInput, "cadence" | "nextRun" | "template" | "type">) {
  return [
    "recurring",
    input.type,
    input.cadence,
    input.nextRun,
    input.template.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  ].filter(Boolean).join(":")
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

async function assertCategoryInOrganization(organizationId: string, categoryId: string, type: "revenue" | "expense") {
  const [category] = await db
    .select({ archived: categories.archived, id: categories.id, kind: categories.kind, parentId: categories.parentId })
    .from(categories)
    .where(and(eq(categories.organizationId, organizationId), eq(categories.id, categoryId)))
    .limit(1)

  if (!category) {
    throw new UnprocessableError("Category does not belong to this organization")
  }

  if (category.kind !== type) {
    throw new UnprocessableError("Category kind must match the recurring item type")
  }

  if (category.parentId) {
    throw new UnprocessableError("Recurring item category must be a root category")
  }

  if (category.archived) {
    throw new UnprocessableError("Category is archived")
  }
}

async function assertSubcategoryInOrganization(
  organizationId: string,
  subcategoryId: string | null | undefined,
  categoryId: string,
  type: "revenue" | "expense"
) {
  if (!subcategoryId) return

  const [subcategory] = await db
    .select({ archived: categories.archived, id: categories.id, kind: categories.kind, parentId: categories.parentId })
    .from(categories)
    .where(and(eq(categories.organizationId, organizationId), eq(categories.id, subcategoryId)))
    .limit(1)

  if (!subcategory) {
    throw new UnprocessableError("Subcategory does not belong to this organization")
  }

  if (subcategory.kind !== type || subcategory.parentId !== categoryId) {
    throw new UnprocessableError("Subcategory must belong to the selected category and type")
  }

  if (subcategory.archived) {
    throw new UnprocessableError("Subcategory is archived")
  }
}

async function assertClientInOrganization(organizationId: string, clientId: string | null | undefined) {
  if (!clientId) return

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)))
    .limit(1)

  if (!client) {
    throw new UnprocessableError("Client does not belong to this organization")
  }
}

async function assertUniqueIdempotencyKey(organizationId: string, idempotencyKey: string, currentId?: string) {
  const [existing] = await db
    .select({ id: recurringItems.id })
    .from(recurringItems)
    .where(and(eq(recurringItems.organizationId, organizationId), eq(recurringItems.idempotencyKey, idempotencyKey)))
    .limit(1)

  if (existing && existing.id !== currentId) {
    throw new ConflictError("Recurring item idempotency key already exists")
  }
}

export async function createRecurringItem(context: AuthOrganizationContext, input: CreateRecurringItemInput) {
  const organizationId = context.organization.id
  const idempotencyKey = input.idempotencyKey?.trim() || idempotencyKeyFor(input)

  await assertDepartmentInOrganization(organizationId, input.departmentId)
  await assertCategoryInOrganization(organizationId, input.categoryId, input.type)
  await assertSubcategoryInOrganization(organizationId, input.subcategoryId, input.categoryId, input.type)
  await assertClientInOrganization(organizationId, input.type === "revenue" ? input.clientId : null)
  await assertUniqueIdempotencyKey(organizationId, idempotencyKey)

  const [created] = await db
    .insert(recurringItems)
    .values({
      active: true,
      amount: input.amount,
      cadence: input.cadence,
      categoryId: input.categoryId,
      clientId: input.type === "revenue" ? (input.clientId ?? null) : null,
      currency: input.currency,
      departmentId: input.departmentId,
      fxRateToUsd: fxRateForCurrency(input.currency, input.fxRateToUsd),
      idempotencyKey,
      nextRun: input.nextRun,
      organizationId,
      subcategoryId: input.subcategoryId ?? null,
      template: input.template,
      type: input.type,
      vendor: input.type === "expense" ? (input.vendor ?? null) : null,
    })
    .returning()

  await db.insert(auditLogs).values({
    action: "recurring_item.create",
    actorId: context.user.id,
    entityId: created.id,
    entityType: "recurring_item",
    metadata: { after: created },
    organizationId,
  })

  return toRecurringItem(created)
}

export async function updateRecurringItem(context: AuthOrganizationContext, id: string, input: UpdateRecurringItemInput) {
  const organizationId = context.organization.id
  const before = await getRecurringItemForOrganization(organizationId, id)

  if (!before) {
    throw new NotFoundError("Recurring item not found")
  }

  const nextType = input.type ?? before.type
  const nextCategoryId = input.categoryId ?? before.categoryId
  const nextCurrency = input.currency ?? before.currency
  const nextIdempotencyKey = input.idempotencyKey?.trim() || before.idempotencyKey

  if (input.departmentId) await assertDepartmentInOrganization(organizationId, input.departmentId)
  if (input.categoryId || input.type) await assertCategoryInOrganization(organizationId, nextCategoryId, nextType)
  if ("subcategoryId" in input || input.categoryId || input.type) {
    await assertSubcategoryInOrganization(
      organizationId,
      input.subcategoryId === undefined ? before.subcategoryId : input.subcategoryId,
      nextCategoryId,
      nextType
    )
  }
  if ("clientId" in input || input.type) await assertClientInOrganization(organizationId, nextType === "revenue" ? input.clientId ?? before.clientId : null)
  if (nextIdempotencyKey !== before.idempotencyKey) await assertUniqueIdempotencyKey(organizationId, nextIdempotencyKey, id)

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(recurringItems)
      .set({
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.amount === undefined ? {} : { amount: input.amount }),
        ...(input.cadence === undefined ? {} : { cadence: input.cadence }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        clientId: nextType === "revenue" ? (input.clientId === undefined ? before.clientId : input.clientId) : null,
        ...(input.currency === undefined ? {} : { currency: input.currency }),
        ...(input.departmentId === undefined ? {} : { departmentId: input.departmentId }),
        ...(input.currency === undefined && input.fxRateToUsd === undefined ? {} : { fxRateToUsd: fxRateForCurrency(nextCurrency, input.fxRateToUsd) }),
        ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: nextIdempotencyKey }),
        ...(input.nextRun === undefined ? {} : { nextRun: input.nextRun }),
        ...("subcategoryId" in input ? { subcategoryId: input.subcategoryId ?? null } : {}),
        ...(input.template === undefined ? {} : { template: input.template }),
        ...(input.type === undefined ? {} : { type: input.type }),
        vendor: nextType === "expense" ? (input.vendor === undefined ? before.vendor : input.vendor) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(recurringItems.organizationId, organizationId), eq(recurringItems.id, id)))
      .returning()

    await tx.insert(auditLogs).values({
      action: input.active === false ? "recurring_item.archive" : "recurring_item.update",
      actorId: context.user.id,
      entityId: id,
      entityType: "recurring_item",
      metadata: { after: row, before },
      organizationId,
    })

    return [row]
  })

  return toRecurringItem(updated)
}
