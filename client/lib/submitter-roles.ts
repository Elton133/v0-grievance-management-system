import type { RoleConfig } from "@/lib/settings-context"

export const STUDENT_ROLE = "student"

/** Roles that submit petitions (student). */
export function isSubmitterMemberRole(role: string, rolesConfig?: RoleConfig[]): boolean {
  if (role === STUDENT_ROLE) return true
  const rc = rolesConfig?.find((r) => r.key === role)
  return rc?.isSubmitter === true
}
