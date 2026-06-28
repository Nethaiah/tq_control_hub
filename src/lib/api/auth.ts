import { cookies } from "next/headers"
import type { User } from "@supabase/supabase-js"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  departments,
  memberDepartmentAccess,
  organizationMembers,
  organizations,
  profiles,
} from "@/lib/db/schema"
import { createClient } from "@/lib/supabase/server"

import { UnauthorizedError } from "./errors"

export const DEFAULT_ORGANIZATION_SLUG = "techquarters"

export type UserRole = "owner" | "staff"

export type AuthOrganizationContext = {
  user: User
  profile: typeof profiles.$inferSelect
  organization: typeof organizations.$inferSelect
  membership: typeof organizationMembers.$inferSelect | null
  departmentIds: string[]
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError()
  }

  return user
}

export async function getOptionalAuthContext(): Promise<AuthOrganizationContext | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  await ensureProfileForUser(user)

  return getOrganizationContextForUser(user)
}

export async function requireAuthContext() {
  const context = await getOptionalAuthContext()

  if (!context) {
    throw new UnauthorizedError()
  }

  return context
}

export async function getCurrentSession() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

export async function ensureProfileForUser(user: User) {
  const email = user.email?.toLowerCase()

  if (!email) {
    throw new UnauthorizedError("Authenticated user is missing an email address")
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim().length > 0
      ? user.user_metadata.full_name.trim()
      : email.split("@")[0]

  await db
    .insert(profiles)
    .values({
      id: user.id,
      email,
      fullName,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email,
        fullName,
        updatedAt: new Date(),
      },
    })
}

export async function getOrganizationContextForUser(user: User): Promise<AuthOrganizationContext> {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, DEFAULT_ORGANIZATION_SLUG))
    .limit(1)

  if (!organization) {
    throw new UnauthorizedError("Default organization has not been seeded")
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.status, "active")
      )
    )
    .limit(1)

  const accessRows = membership
    ? membership.role === "owner"
      ? await db
          .select({ departmentId: departments.id })
          .from(departments)
          .where(eq(departments.organizationId, membership.organizationId))
      : await db
          .select({ departmentId: memberDepartmentAccess.departmentId })
          .from(memberDepartmentAccess)
          .where(eq(memberDepartmentAccess.memberId, membership.id))
    : []

  return {
    user,
    profile,
    organization,
    membership: membership ?? null,
    departmentIds: accessRows.map((row) => row.departmentId),
  }
}
