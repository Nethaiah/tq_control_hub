import { and, asc, eq } from "drizzle-orm"

import { requireAuthContext } from "@/lib/api/auth"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { db } from "@/lib/db"
import {
  departments,
  memberDepartmentAccess,
  organizationMembers,
  profiles,
} from "@/lib/db/schema"

export async function GET() {
  try {
    const context = await requireAuthContext()
    requireOwner(context)
    const organizationId = context.organization.id

    const [departmentRows, profileRows, accessRows] = await Promise.all([
      db
        .select({
          active: departments.active,
          color: departments.color,
          id: departments.id,
          name: departments.name,
        })
        .from(departments)
        .where(eq(departments.organizationId, organizationId))
        .orderBy(asc(departments.name)),
      db
        .select({
          email: profiles.email,
          fullName: profiles.fullName,
          memberId: organizationMembers.id,
          role: organizationMembers.role,
          status: organizationMembers.status,
          userId: profiles.id,
        })
        .from(profiles)
        .leftJoin(
          organizationMembers,
          and(
            eq(organizationMembers.userId, profiles.id),
            eq(organizationMembers.organizationId, organizationId)
          )
        )
        .orderBy(asc(profiles.fullName), asc(profiles.email)),
      db
        .select({
          departmentId: memberDepartmentAccess.departmentId,
          memberId: memberDepartmentAccess.memberId,
        })
        .from(memberDepartmentAccess)
        .innerJoin(
          organizationMembers,
          eq(memberDepartmentAccess.memberId, organizationMembers.id)
        )
        .where(eq(organizationMembers.organizationId, organizationId)),
    ])

    const departmentIdsByMember = new Map<string, string[]>()

    for (const row of accessRows) {
      const departmentIds = departmentIdsByMember.get(row.memberId) ?? []
      departmentIds.push(row.departmentId)
      departmentIdsByMember.set(row.memberId, departmentIds)
    }

    return success({
      departments: departmentRows,
      members: profileRows.map((row) => ({
        departmentIds: row.memberId ? (departmentIdsByMember.get(row.memberId) ?? []) : [],
        email: row.email,
        fullName: row.fullName,
        memberId: row.memberId,
        role: row.role,
        status: row.status,
        userId: row.userId,
      })),
    })
  } catch (error) {
    return apiError(error)
  }
}
