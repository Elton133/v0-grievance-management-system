import type { RoleConfig } from "@/lib/settings-context"

/** Platform operator — settings, staff accounts, email; not petition workflow. */
export const SYSTEM_ADMIN_ROLE = "admin"

export function isSystemAdminRole(role: string): boolean {
  return role.trim().toLowerCase() === SYSTEM_ADMIN_ROLE
}

/** Roles in the escalation chain (advisor → hod → registrar). Excludes system admin. */
export function getWorkflowReviewerRoles(rolesConfig: RoleConfig[] | undefined): RoleConfig[] {
  return (rolesConfig ?? [])
    .filter((r) => !r.isSubmitter && Number(r.level) > 0 && !isSystemAdminRole(r.key))
    .sort((a, b) => Number(a.level) - Number(b.level))
}

export function isPetitionReviewerRole(role: string, rolesConfig?: RoleConfig[]): boolean {
  if (isSystemAdminRole(role)) return false
  if (["advisor", "class_advisor", "hod", "registrar"].includes(role)) return true
  return getWorkflowReviewerRoles(rolesConfig).some((r) => r.key === role)
}

/** Where staff land after login. */
export function getStaffHomePath(role: string, isSubmitter: (r: string) => boolean): string {
  if (isSubmitter(role)) return "/dashboard"
  if (isSystemAdminRole(role)) return "/settings"
  return "/admin"
}
