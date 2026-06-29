import { and, asc, eq } from "drizzle-orm"

import type { Category } from "@/domain/types"

import { db } from "../index"
import { categories } from "../schema"

export function toCategory(row: typeof categories.$inferSelect): Category {
  return {
    archived: row.archived,
    id: row.id,
    kind: row.kind,
    name: row.name,
    parentId: row.parentId,
  }
}

export async function listCategories(organizationId: string) {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
    .orderBy(asc(categories.kind), asc(categories.parentId), asc(categories.name))

  return rows.map(toCategory)
}

export async function getCategoryForOrganization(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.organizationId, organizationId), eq(categories.id, id)))
    .limit(1)

  return row ?? null
}
