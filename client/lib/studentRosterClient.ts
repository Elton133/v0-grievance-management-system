import { registryApi } from "./api"

export type RosterValidationIssueClient = {
  path: "name" | "submitterId" | "group"
  message: string
}

let registryEnabledCache: boolean | null = null

export async function fetchRegistryValidationEnabled(): Promise<boolean> {
  if (registryEnabledCache !== null) return registryEnabledCache
  try {
    const res = await registryApi.status()
    registryEnabledCache = res.enabled === true
    return registryEnabledCache
  } catch {
    registryEnabledCache = false
    return false
  }
}

/** @deprecated Use fetchRegistryValidationEnabled — kept for sync callers during transition. */
export function rosterValidationEnabledClient(): boolean {
  return registryEnabledCache === true
}

export async function validateMemberAgainstRegistryClient(
  memberType: string,
  fullName: string,
  studentId: string,
  department?: string
): Promise<RosterValidationIssueClient | null> {
  const enabled = await fetchRegistryValidationEnabled()
  if (!enabled) return null
  try {
    const res = await registryApi.validate({
      memberType,
      fullName: fullName.trim(),
      studentId: studentId.trim(),
      department: department?.trim(),
    })
    if (res.ok) return null
    const path = (res.path === "name" || res.path === "submitterId" || res.path === "group"
      ? res.path
      : "submitterId") as RosterValidationIssueClient["path"]
    return { path, message: res.message || "Registry validation failed." }
  } catch {
    return null
  }
}

type RolesOnly = { rolesConfig?: { key: string; isSubmitter?: boolean }[] }

/** Live checks against the registry API (student and alumni). */
export async function getLiveRosterRegistrationIssues(
  data: { role: string; name: string; submitterId?: string; group?: string },
  _settings: RolesOnly
): Promise<Partial<Record<"name" | "submitterId" | "group", string>>> {
  if (data.role !== "student" && data.role !== "alumni") return {}
  const sid = data.submitterId?.trim()
  const name = data.name?.trim()
  if (!sid || !name) return {}
  const issue = await validateMemberAgainstRegistryClient(
    data.role === "alumni" ? "alumni" : "student",
    name,
    sid,
    data.group?.trim()
  )
  if (!issue) return {}
  return { [issue.path]: issue.message }
}
