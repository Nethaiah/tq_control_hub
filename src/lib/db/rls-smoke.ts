import "dotenv/config"

import { and, count, eq, inArray } from "drizzle-orm"

import { client, db } from "./index"
import {
  memberDepartmentAccess,
  organizationMembers,
  organizations,
  people,
  transactions,
} from "./schema"

const ORGANIZATION_SLUG = "techquarters"

async function countAsAuthenticatedUser(userId: string, sqlText: string) {
  return client.begin(async (tx) => {
    await tx`set local role authenticated`
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`
    const rows = await tx.unsafe(sqlText)
    return Number(rows[0]?.count ?? 0)
  })
}

async function assertAnonBlocked() {
  let visibleRows = 0

  try {
    visibleRows = await client.begin(async (tx) => {
      await tx`set local role anon`
      const rows = await tx`select count(*)::int as count from transactions`
      return Number(rows[0]?.count ?? 0)
    })
  } catch {
    return
  }

  if (visibleRows !== 0) {
    throw new Error(`Anon role saw ${visibleRows} transaction rows`)
  }
}

async function smoke() {
  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, ORGANIZATION_SLUG))
    .limit(1)

  if (!organization) {
    throw new Error("Missing seeded organization")
  }

  const [ownerMembership] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.role, "owner"),
        eq(organizationMembers.status, "active")
      )
    )
    .limit(1)

  if (!ownerMembership) {
    throw new Error("Missing active owner membership")
  }

  const [totalLedger] = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.organizationId, organization.id))
  const [peopleTotal] = await db
    .select({ count: count() })
    .from(people)
    .where(eq(people.organizationId, organization.id))

  const ownerLedgerCount = await countAsAuthenticatedUser(
    ownerMembership.userId,
    "select count(*)::int as count from transactions"
  )

  await assertAnonBlocked()

  if (ownerLedgerCount !== totalLedger.count) {
    throw new Error(`Owner saw ${ownerLedgerCount} ledger rows, expected ${totalLedger.count}`)
  }

  const [staffMembership] = await db
    .select({ id: organizationMembers.id, userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.role, "staff"),
        eq(organizationMembers.status, "active")
      )
    )
    .limit(1)

  if (!staffMembership) {
    console.log(
      `RLS smoke passed: owner=${ownerLedgerCount} ledger rows, anon blocked; staff scope skipped because no real staff member exists`
    )
    return
  }

  const accessRows = await db
    .select({ departmentId: memberDepartmentAccess.departmentId })
    .from(memberDepartmentAccess)
    .where(eq(memberDepartmentAccess.memberId, staffMembership.id))

  const [staffScopedLedger] = accessRows.length
    ? await db
        .select({ count: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.organizationId, organization.id),
            inArray(
              transactions.departmentId,
              accessRows.map((row) => row.departmentId)
            )
          )
        )
    : [{ count: 0 }]

  const staffLedgerCount = await countAsAuthenticatedUser(
    staffMembership.userId,
    "select count(*)::int as count from transactions"
  )
  const staffPeopleCount = await countAsAuthenticatedUser(
    staffMembership.userId,
    "select count(*)::int as count from people"
  )

  if (staffLedgerCount !== staffScopedLedger.count) {
    throw new Error(`Staff saw ${staffLedgerCount} ledger rows, expected ${staffScopedLedger.count}`)
  }

  if (peopleTotal.count > 0 && staffPeopleCount !== 0) {
    throw new Error(`Staff saw ${staffPeopleCount} people rows; payroll table should be owner-only`)
  }

  console.log(
    `RLS smoke passed: owner=${ownerLedgerCount} ledger rows, staff=${staffLedgerCount} scoped rows, staff people=${staffPeopleCount}, anon blocked`
  )
}

smoke()
  .then(async () => {
    await client.end()
  })
  .catch(async (error) => {
    console.error("RLS smoke failed", error)
    await client.end()
    process.exit(1)
  })
