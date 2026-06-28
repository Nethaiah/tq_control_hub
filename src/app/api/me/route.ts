import { sql } from "drizzle-orm"

import { apiError, success, unauthorized } from "@/lib/api/responses"
import { getOptionalAuthContext } from "@/lib/api/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const context = await getOptionalAuthContext()

    if (!context) {
      return unauthorized("not_authenticated", "No active session")
    }

    await db.execute(sql`select 1 as connected`)

    return success({
      dbConnected: true,
      departmentIds: context.departmentIds,
      hasAccess: Boolean(context.membership),
      membership: context.membership
        ? {
            id: context.membership.id,
            organizationId: context.membership.organizationId,
            role: context.membership.role,
            status: context.membership.status,
          }
        : null,
      profile: {
        email: context.profile.email,
        fullName: context.profile.fullName,
        id: context.profile.id,
      },
      user: {
        email: context.user.email,
        id: context.user.id,
      },
    })
  } catch (error) {
    return apiError(error)
  }
}
