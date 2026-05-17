import { z } from "zod"
import { registrationPasswordSchema } from "./password-policy"
import { normalizeAllowedEmailDomains } from "./allowed-email-domains"
import { effectiveGroupPrefixes, DEFAULT_RMU_GROUP_PREFIXES } from "./rmu-departments"
import { rosterValidationEnabledClient, validateStudentAgainstRosterClient } from "./studentRosterClient"

export { DEFAULT_RMU_GROUP_PREFIXES as DEPARTMENT_INDEX_PREFIXES }

type RegistrationFormSettings = {
  rolesConfig: { key: string; isSubmitter?: boolean; groupScoped?: boolean }[]
  allowedEmailDomains: string[]
  groupPrefixes?: Record<string, string[]>
}
const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["st.rmu.edu.gh", "rmu.edu.gh"]

function validateStudentIndexForDepartment(
  indexNumber: string,
  group: string,
  prefixes: Record<string, string[]>
): boolean {
  const deptPrefixes = prefixes[group]
  if (!deptPrefixes) return false
  return deptPrefixes.some((prefix) => indexNumber.toUpperCase().startsWith(prefix))
}

/**
 * While the user types, treat the ID as valid if it could still become a valid index
 * (matches a configured prefix, or is a prefix of one). Submit still requires full `startsWith(prefix)`.
 */
export function isStudentIdPrefixCompatibleWithDepartment(
  submitterId: string,
  group: string,
  settings: Pick<RegistrationFormSettings, "groupPrefixes">
): boolean {
  const g = group.trim()
  const sid = submitterId.trim().toUpperCase()
  if (!g || !sid) return true
  const map = effectiveGroupPrefixes(settings.groupPrefixes ?? null)
  const deptPrefixes = map[g]
  if (!deptPrefixes?.length) return true
  return deptPrefixes.some((p) => {
    const pu = p.toUpperCase()
    return pu.startsWith(sid) || sid.startsWith(pu)
  })
}

/** Live feedback while typing: ID must still be completable to a valid prefix for the department. */
export function getLiveStudentIdPrefixError(
  data: { role: string; submitterId?: string; group?: string },
  settings: RegistrationFormSettings
): string | undefined {
  const submitterKey = getSubmitterRoleKey(settings)
  if (data.role !== submitterKey) return undefined
  const g = data.group?.trim()
  const sid = data.submitterId?.trim()
  if (!g || !sid) return undefined
  if (isStudentIdPrefixCompatibleWithDepartment(sid, g, settings)) return undefined
  const deptPrefixes = effectiveGroupPrefixes(settings.groupPrefixes ?? null)
  const prefixes = deptPrefixes[g] || []
  if (prefixes.length === 0) return undefined
  return `Student ID must start with one of: ${prefixes.join(", ")} for ${g}`
}

function hostMatchesAllowedDomain(email: string, domain: string): boolean {
  const at = email.lastIndexOf("@")
  if (at < 0) return false
  const host = email.slice(at + 1).toLowerCase()
  const d = domain.toLowerCase()
  return host === d || host.endsWith(`.${d}`)
}

function buildEmailSchema(settings: RegistrationFormSettings) {
  const normalizedRaw = normalizeAllowedEmailDomains(settings.allowedEmailDomains)
  const normalized = normalizedRaw.length > 0 ? normalizedRaw : DEFAULT_ALLOWED_EMAIL_DOMAINS
  return z
    .string()
    .email("Invalid email format")
    .refine(
      (email) => normalized.some((domain) => hostMatchesAllowedDomain(email, domain)),
      {
        message: `Email must be from: ${normalized.join(", ")}`,
      }
    )
}

type RegistrationRolesContext = Pick<RegistrationFormSettings, "rolesConfig">

function getSubmitterRoleKey(settings: RegistrationRolesContext): string {
  return (settings.rolesConfig ?? []).find((r) => r.isSubmitter)?.key ?? "student"
}

/**
 * Whether registration must collect a department (stored as `group` in the API).
 * Submitters always need one. Staff need one unless the role is explicitly not department-scoped (e.g. registrar).
 * `groupScoped: undefined` is treated as true so custom staff roles default to requiring a department.
 */
export function registrationRoleRequiresGroup(role: string, settings: RegistrationRolesContext): boolean {
  const roles = settings.rolesConfig ?? []
  const submitterKey = getSubmitterRoleKey(settings)
  if (role === submitterKey) return true
  const rc = roles.find((r) => r.key === role)
  if (rc !== undefined) return rc.groupScoped !== false
  if (role === "registrar") return false
  return true
}

/** Registration form validation aligned with server `createRegistrationSchema`. */
export function createRegistrationFormSchema(settings: RegistrationFormSettings) {
  const submitterKey = getSubmitterRoleKey(settings)
  const emailSchema = buildEmailSchema(settings)
  const allowedDepartments = Object.keys(effectiveGroupPrefixes(settings.groupPrefixes ?? null))

  return z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: emailSchema,
      password: registrationPasswordSchema,
      confirmPassword: z.string(),
      role: z.string(),
      submitterId: z.string().optional(),
      group: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.role !== submitterKey) return true
        return !!data.submitterId && data.submitterId.trim().length > 0
      },
      {
        message: "Student ID is required for students",
        path: ["submitterId"],
      }
    )
    .refine(
      (data) => {
        if (!registrationRoleRequiresGroup(data.role, settings)) return true
        return !!data.group && data.group.trim().length > 0
      },
      {
        message: "Department is required for this role",
        path: ["group"],
      }
    )
    .refine(
      (data) => {
        if (!registrationRoleRequiresGroup(data.role, settings)) return true
        const g = data.group?.trim()
        if (!g) return true
        if (allowedDepartments.length === 0) return true
        return allowedDepartments.includes(g)
      },
      {
        message: "Choose a department from the list",
        path: ["group"],
      }
    )
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    })
    .superRefine((data, ctx) => {
      if (data.role !== submitterKey) return
      const sid = data.submitterId?.trim()
      const g = data.group?.trim()
      if (!sid || !g) return
      const deptPrefixes = effectiveGroupPrefixes(settings.groupPrefixes ?? null)
      if (validateStudentIndexForDepartment(sid, g, deptPrefixes)) return
      const prefixes = deptPrefixes[g] || []
      if (prefixes.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Student ID must start with one of: ${prefixes.join(", ")} for ${g}`,
          path: ["submitterId"],
        })
      }
    })
    .superRefine((data, ctx) => {
      if (data.role !== submitterKey || !rosterValidationEnabledClient()) return
      const sid = data.submitterId?.trim()
      if (!sid) return
      const issue = validateStudentAgainstRosterClient(data.name.trim(), sid, data.group?.trim())
      if (issue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: [issue.path],
        })
      }
    })
}

/** @deprecated Use createRegistrationFormSchema(settings) so group rules match tenant roles. */
export const registrationSchema = createRegistrationFormSchema({
  rolesConfig: [
    { key: "student", isSubmitter: true, groupScoped: true },
    { key: "advisor", groupScoped: true },
    { key: "hod", groupScoped: true },
    { key: "registrar", groupScoped: false },
  ],
  allowedEmailDomains: [],
  groupPrefixes: DEFAULT_RMU_GROUP_PREFIXES,
})

export type RegistrationFormData = {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: string
  submitterId?: string
  group?: string
}
