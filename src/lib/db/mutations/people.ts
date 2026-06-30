import { and, eq } from "drizzle-orm"

import type { Person, PersonFormValues } from "@/domain/types"
import type { AuthOrganizationContext } from "@/lib/api/auth"
import { UnprocessableError } from "@/lib/api/errors"

import { db } from "../index"
import { auditLogs, departments, people } from "../schema"

function toPerson(row: typeof people.$inferSelect): Person {
  return {
    cadence: row.cadence,
    costUsd: Number(row.costUsd ?? 0),
    departmentId: row.departmentId,
    id: row.id,
    name: row.name,
    role: row.role,
    startDate: row.startDate,
    status: row.status,
    transactionIds: [],
    type: row.type,
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

export async function createPerson(context: AuthOrganizationContext, input: PersonFormValues) {
  const organizationId = context.organization.id
  await assertDepartmentInOrganization(organizationId, input.departmentId)

  const [created] = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(people)
      .values({
        cadence: input.cadence,
        costUsd: input.costUsd,
        departmentId: input.departmentId,
        name: input.name,
        organizationId,
        payrollSensitive: true,
        role: input.role,
        startDate: input.startDate,
        status: input.status,
        type: input.type,
      })
      .returning()

    await tx.insert(auditLogs).values({
      action: "person.create",
      actorId: context.user.id,
      entityId: row.id,
      entityType: "person",
      metadata: { after: row },
      organizationId,
    })

    return [row]
  })

  return toPerson(created)
}
