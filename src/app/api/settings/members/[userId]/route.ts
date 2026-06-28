import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { requireAuthContext } from "@/lib/api/auth"
import { BadRequestError, NotFoundError, UnprocessableError } from "@/lib/api/errors"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseBody, parseQuery } from "@/lib/api/validation"
import { db } from "@/lib/db"
import {
  departments,
  memberDepartmentAccess,
  organizationMembers,
  profiles,
} from "@/lib/db/schema"

const paramsSchema = z.object({
  userId: z.uuid(),
})

const memberUpdateSchema = z.object({
  departmentIds: z.array(z.uuid()).default([]),
  role: z.enum(["owner", "staff"]),
  status: z.enum(["active", "invited", "disabled"]),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const { userId } = parseQuery(paramsSchema, await params)
    const body = parseBody(memberUpdateSchema, await request.json().catch(() => ({})))
    const departmentIds = [...new Set(body.departmentIds)]
    const organizationId = context.organization.id

    if (userId === context.user.id && (body.role !== "owner" || body.status !== "active")) {
      throw new UnprocessableError("You cannot remove your own active owner access")
    }

    const [profile] = await db
      .select({
        email: profiles.email,
        fullName: profiles.fullName,
        id: profiles.id,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)

    if (!profile) {
      throw new NotFoundError("User profile not found")
    }

    if (departmentIds.length > 0) {
      const validDepartments = await db
        .select({ id: departments.id })
        .from(departments)
        .where(
          and(
            eq(departments.organizationId, organizationId),
            inArray(departments.id, departmentIds)
          )
        )

      if (validDepartments.length !== departmentIds.length) {
        throw new BadRequestError(
          "validation_error",
          "One or more departments are not valid for this organization"
        )
      }
    }

    const [member] = await db.transaction(async (tx) => {
      const [upsertedMember] = await tx
        .insert(organizationMembers)
        .values({
          organizationId,
          role: body.role,
          status: body.status,
          userId,
        })
        .onConflictDoUpdate({
          target: [organizationMembers.organizationId, organizationMembers.userId],
          set: {
            role: body.role,
            status: body.status,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: organizationMembers.id,
          role: organizationMembers.role,
          status: organizationMembers.status,
        })

      await tx
        .delete(memberDepartmentAccess)
        .where(eq(memberDepartmentAccess.memberId, upsertedMember.id))

      if (body.role === "staff" && departmentIds.length > 0) {
        await tx
          .insert(memberDepartmentAccess)
          .values(
            departmentIds.map((departmentId) => ({
              departmentId,
              memberId: upsertedMember.id,
            }))
          )
          .onConflictDoNothing()
      }

      return [upsertedMember]
    })

    return success({
      member: {
        departmentIds: body.role === "staff" ? departmentIds : [],
        email: profile.email,
        fullName: profile.fullName,
        memberId: member.id,
        role: member.role,
        status: member.status,
        userId: profile.id,
      },
    })
  } catch (error) {
    return apiError(error)
  }
}
