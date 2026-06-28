import type { AuthOrganizationContext } from "./auth"
import { ForbiddenError } from "./errors"

export function requireMembership(context: AuthOrganizationContext) {
  if (!context.membership) {
    throw new ForbiddenError("Organization access required")
  }
}

export function requireOwner(context: AuthOrganizationContext) {
  requireMembership(context)

  if (context.membership?.role !== "owner") {
    throw new ForbiddenError("Owner access required")
  }
}

export function requireDepartmentAccess(context: AuthOrganizationContext, departmentId: string) {
  requireMembership(context)

  if (context.membership?.role === "owner") {
    return
  }

  if (!context.departmentIds.includes(departmentId)) {
    throw new ForbiddenError("Department access denied")
  }
}

export function canViewPayrollDetails(context: AuthOrganizationContext) {
  return context.membership?.role === "owner"
}
