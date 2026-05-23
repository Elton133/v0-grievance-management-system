export const SYSTEM_ADMIN_ROLE = "admin"

export function isSystemAdminRole(role: string): boolean {
  return role.trim().toLowerCase() === SYSTEM_ADMIN_ROLE
}

type RoleRow = { key: string; level: number; isSubmitter?: boolean }

export function getWorkflowReviewerRoles(roles: RoleRow[]): RoleRow[] {
  return roles
    .filter((r) => r.isSubmitter !== true && Number(r.level) > 0 && !isSystemAdminRole(r.key))
    .sort((a, b) => Number(a.level) - Number(b.level))
}
