import "dotenv/config"

import { and, count, eq, isNull } from "drizzle-orm"

import { client, db } from "./index"
import { categories, departments, organizations, transactions } from "./schema"

const ORGANIZATION_SLUG = "techquarters"

async function smoke() {
  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, ORGANIZATION_SLUG))
    .limit(1)

  if (!organization) {
    throw new Error("Missing seeded organization")
  }

  const [ledger] = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.organizationId, organization.id))

  const [departmentCount] = await db
    .select({ count: count() })
    .from(departments)
    .where(eq(departments.organizationId, organization.id))

  const [rootCategories] = await db
    .select({ count: count() })
    .from(categories)
    .where(and(eq(categories.organizationId, organization.id), isNull(categories.parentId)))

  if (!ledger || ledger.count === 0) {
    throw new Error("Missing seeded ledger rows")
  }

  if (!departmentCount || departmentCount.count === 0) {
    throw new Error("Missing seeded departments")
  }

  if (!rootCategories || rootCategories.count === 0) {
    throw new Error("Missing seeded root categories")
  }

  console.log(
    `DB smoke passed: ${ledger.count} ledger rows, ${departmentCount.count} departments, ${rootCategories.count} root categories`
  )
}

smoke()
  .then(async () => {
    await client.end()
  })
  .catch(async (error) => {
    console.error("DB smoke failed", error)
    await client.end()
    process.exit(1)
  })
