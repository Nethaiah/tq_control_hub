import { and, eq } from "drizzle-orm"

import type { AuthOrganizationContext } from "@/lib/api/auth"
import { NotFoundError, UnprocessableError } from "@/lib/api/errors"

import { db } from "../index"
import { auditLogs, categories } from "../schema"
import { getCategoryForOrganization, toCategory } from "../queries/categories"

export type CreateCategoryInput = {
  kind: "revenue" | "expense"
  name: string
  parentId?: string | null
}

export type UpdateCategoryInput = Partial<{
  archived: boolean
  name: string
  parentId: string | null
}>

async function assertValidParent(organizationId: string, kind: "revenue" | "expense", parentId?: string | null) {
  if (!parentId) return null

  const parent = await getCategoryForOrganization(organizationId, parentId)

  if (!parent) {
    throw new UnprocessableError("Parent category does not belong to this organization")
  }

  if (parent.parentId) {
    throw new UnprocessableError("Subcategories cannot be nested under another subcategory")
  }

  if (parent.kind !== kind) {
    throw new UnprocessableError("Parent category kind must match the category kind")
  }

  if (parent.archived) {
    throw new UnprocessableError("Parent category is archived")
  }

  return parent
}

export async function createCategory(context: AuthOrganizationContext, input: CreateCategoryInput) {
  const organizationId = context.organization.id
  await assertValidParent(organizationId, input.kind, input.parentId)

  const [created] = await db
    .insert(categories)
    .values({
      archived: false,
      kind: input.kind,
      name: input.name,
      organizationId,
      parentId: input.parentId || null,
    })
    .returning()

  await db.insert(auditLogs).values({
    action: "category.create",
    actorId: context.user.id,
    entityId: created.id,
    entityType: "category",
    metadata: { after: created },
    organizationId,
  })

  return toCategory(created)
}

export async function updateCategory(context: AuthOrganizationContext, id: string, input: UpdateCategoryInput) {
  const organizationId = context.organization.id
  const before = await getCategoryForOrganization(organizationId, id)

  if (!before) {
    throw new NotFoundError("Category not found")
  }

  if (input.parentId === id) {
    throw new UnprocessableError("A category cannot be its own parent")
  }

  if ("parentId" in input) {
    await assertValidParent(organizationId, before.kind, input.parentId)
  }

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(categories)
      .set({
        ...(input.archived === undefined ? {} : { archived: input.archived }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...("parentId" in input ? { parentId: input.parentId || null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(categories.organizationId, organizationId), eq(categories.id, id)))
      .returning()

    await tx.insert(auditLogs).values({
      action: input.archived ? "category.archive" : "category.update",
      actorId: context.user.id,
      entityId: id,
      entityType: "category",
      metadata: { after: row, before },
      organizationId,
    })

    return [row]
  })

  return toCategory(updated)
}
