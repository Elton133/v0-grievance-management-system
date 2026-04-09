import { z } from "zod"
import { registrationPasswordSchema } from "./password-policy"
import { normalizeAllowedEmailDomains } from "./allowed-email-domains"

// Group to index number prefix mapping
const DEPARTMENT_INDEX_PREFIXES: Record<string, string[]> = {
  ICT: ["BIT", "BCS", "BCE", "DIT"],
  Transport: ["BPS", "BLG", "DPS"],
  "Marine Electrical & Electronic Engineering": ["BEE", "BME"],
  "Nautical Science": ["BNS"],
}

type RegistrationFormSettings = {
  rolesConfig: { key: string; isSubmitter?: boolean; groupScoped?: boolean }[]
  allowedEmailDomains: string[]
}
const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["st.rmu.edu.gh", "rmu.edu.gh"]

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
        message: "Submitter ID is required for submitters",
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
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
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

export { DEPARTMENT_INDEX_PREFIXES }

