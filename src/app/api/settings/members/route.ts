import { and, asc, eq } from "drizzle-orm"

import { requireAuthContext } from "@/lib/api/auth"
import { searchParamsToObject, settingsMembersFilterSchema } from "@/lib/api/filters"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, success } from "@/lib/api/responses"
import { parseQuery } from "@/lib/api/validation"
import { db } from "@/lib/db"
import {
  departments,
  memberDepartmentAccess,
  organizationMembers,
  profiles,
} from "@/lib/db/schema"

type SettingsDepartment = {
  active: boolean
  color: string
  id: string
  name: string
}

type SettingsMember = {
  departmentIds: string[]
  email: string
  fullName: string
  memberId: string | null
  role: "owner" | "staff" | null
  status: "active" | "invited" | "disabled" | null
  userId: string
}

function departmentSummary(departmentsList: SettingsDepartment[], role: SettingsMember["role"], departmentIds: string[]) {
  if (role === "owner") {
    return "All departments"
  }

  const selected = departmentsList.filter((department) => departmentIds.includes(department.id))

  if (selected.length === 0) {
    return "No departments"
  }

  return selected.map((department) => department.name).join(", ")
}

function settingsMemberSortValue(
  member: SettingsMember,
  departmentsList: SettingsDepartment[],
  sortBy: "user" | "access" | "role" | "status" | "departments" | "saved_status"
) {
  if (sortBy === "user") return `${member.fullName} ${member.email}`
  if (sortBy === "access") return member.memberId ? "member" : "pending"
  if (sortBy === "departments") return departmentSummary(departmentsList, member.role, member.departmentIds)
  if (sortBy === "saved_status") return member.status ?? "not assigned"
  return member[sortBy] ?? ""
}

function applyMemberTableOptions(
  members: SettingsMember[],
  departmentsList: SettingsDepartment[],
  options: {
    page: number
    pageSize: number
    search?: string
    sortBy?: "user" | "access" | "role" | "status" | "departments" | "saved_status"
    sortDir?: "asc" | "desc"
  }
) {
  const search = options.search?.trim().toLowerCase()
  const sortBy = options.sortBy ?? "user"
  const sortDir = options.sortDir ?? "asc"
  const filtered = search
    ? members.filter((member) =>
        [
          member.fullName,
          member.email,
          member.memberId ? "member" : "pending",
          member.role ?? "",
          member.status ?? "",
          departmentSummary(departmentsList, member.role, member.departmentIds),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      )
    : members
  const sorted = [...filtered].sort((a, b) => {
    const left = settingsMemberSortValue(a, departmentsList, sortBy)
    const right = settingsMemberSortValue(b, departmentsList, sortBy)
    const result = String(left).localeCompare(String(right))

    return sortDir === "asc" ? result : -result
  })
  const totalRows = sorted.length
  const totalPages = Math.ceil(totalRows / options.pageSize)
  const page = totalPages === 0 ? 1 : Math.min(options.page, totalPages)
  const offset = (page - 1) * options.pageSize

  return {
    members: sorted.slice(offset, offset + options.pageSize),
    pagination: {
      page,
      pageSize: options.pageSize,
      totalPages,
      totalRows,
    },
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)
    const organizationId = context.organization.id
    const query = parseQuery(
      settingsMembersFilterSchema,
      searchParamsToObject(new URL(request.url).searchParams)
    )

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

    const members: SettingsMember[] = profileRows.map((row) => ({
      departmentIds: row.memberId ? (departmentIdsByMember.get(row.memberId) ?? []) : [],
      email: row.email,
      fullName: row.fullName,
      memberId: row.memberId,
      role: row.role,
      status: row.status,
      userId: row.userId,
    }))
    const memberTable = applyMemberTableOptions(members, departmentRows, {
      page: query.membersPage,
      pageSize: query.membersPageSize,
      search: query.membersSearch,
      sortBy: query.membersSortBy,
      sortDir: query.membersSortDir,
    })

    return success({
      departments: departmentRows,
      members: memberTable.members,
      pagination: memberTable.pagination,
    })
  } catch (error) {
    return apiError(error)
  }
}
