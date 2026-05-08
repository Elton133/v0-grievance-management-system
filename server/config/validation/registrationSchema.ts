import { z } from "zod"
import { registrationPasswordSchema } from "./passwordPolicy"
import { normalizeAllowedEmailDomains } from "../utils/allowedEmailDomains"
import { effectiveGroupPrefixes } from "../utils/defaultGroupPrefixes"

// Default valid roles
const DEFAULT_ROLES = ["student", "advisor", "hod", "registrar"]
const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["st.rmu.edu.gh", "rmu.edu.gh"]

// Index number validation based on group
const validateIndexNumber = (indexNumber: string, group: string, prefixes: Record<string, string[]>): boolean => {
  const deptPrefixes = prefixes[group]
  if (!deptPrefixes) return false
  return deptPrefixes.some((prefix) => indexNumber.toUpperCase().startsWith(prefix))
}

/**
 * Create a registration schema with dynamic settings.
 * When tenantSettings are provided, the schema uses those for validation.
 * Otherwise, falls back to hardcoded defaults.
 */
export const createRegistrationSchema = (tenantSettings?: {
  allowedEmailDomains?: string[]
  roles?: string[]
  groupPrefixes?: Record<string, string[]>
  submitterRoleKey?: string
  rolesConfig?: Array<{ key: string; isSubmitter?: boolean; groupScoped?: boolean }>
}) => {
  const emailDomains = normalizeAllowedEmailDomains(tenantSettings?.allowedEmailDomains)

  const validRoles = tenantSettings?.roles?.length
    ? tenantSettings.roles
    : DEFAULT_ROLES

  const submitterRole = tenantSettings?.submitterRoleKey || "student"

  const deptPrefixes = effectiveGroupPrefixes(tenantSettings?.groupPrefixes)
  const allowedDepartments = Object.keys(deptPrefixes)

  const rolesConfig = tenantSettings?.rolesConfig

  /** Staff need a department (`group`) unless explicitly not department-scoped (e.g. registrar). Undefined groupScoped = required. */
  const staffRoleRequiresGroup = (role: string): boolean => {
    const rc = rolesConfig?.find((r) => r.key === role)
    if (rc !== undefined) return rc.groupScoped !== false
    return role !== "registrar"
  }

  // Email validation – allow all domains if settings have empty array or no domains
  const normalizedDomains = (emailDomains.length > 0 ? emailDomains : DEFAULT_ALLOWED_EMAIL_DOMAINS)
    .map((d) => d.trim().toLowerCase().replace(/^@+/, ""))
    .filter(Boolean)

  const hostMatchesAllowedDomain = (email: string, domain: string): boolean => {
    const at = email.lastIndexOf("@")
    if (at < 0) return false
    const host = email.slice(at + 1).toLowerCase()
    const d = domain.toLowerCase()
    return host === d || host.endsWith(`.${d}`)
  }

  const emailSchema = normalizedDomains.length > 0
    ? z
      .string()
      .email("Invalid email format")
      .refine(
        (email) => normalizedDomains.some((domain) => hostMatchesAllowedDomain(email, domain)),
        {
          message: `Email must be from one of: ${normalizedDomains.join(", ")}`,
        }
      )
    : z.string().email("Invalid email format")

  return z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: emailSchema,
      password: registrationPasswordSchema,
      role: z.string().refine((val) => validRoles.includes(val), {
        message: `Role must be one of: ${validRoles.join(", ")}`,
      }).default(submitterRole),
      submitterId: z.string().optional(),
      group: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.role === submitterRole) {
          return !!data.submitterId && data.submitterId.trim().length > 0
        }
        return true
      },
      {
        message: "Submitter ID is required for submitters",
        path: ["submitterId"],
      }
    )
    .refine(
      (data) => {
        if (data.role === submitterRole) {
          return !!data.group && data.group.trim().length > 0
        }
        return true
      },
      {
        message: "Department is required for submitters",
        path: ["group"],
      }
    )
    .refine(
      (data) => {
        if (data.role === submitterRole) return true
        if (!staffRoleRequiresGroup(data.role)) return true
        return !!data.group && data.group.trim().length > 0
      },
      {
        message: "Department is required for this role",
        path: ["group"],
      }
    )
    .refine(
      (data) => {
        const needsGroup =
          data.role === submitterRole || (data.role !== submitterRole && staffRoleRequiresGroup(data.role))
        if (!needsGroup) return true
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
    .superRefine((data, ctx) => {
      if (data.role === submitterRole && data.submitterId && data.group) {
        if (!validateIndexNumber(data.submitterId, data.group, deptPrefixes)) {
          const prefixes = deptPrefixes[data.group] || []
          if (prefixes.length > 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Submitter ID must start with one of: ${prefixes.join(", ")} for ${data.group} department`,
              path: ["submitterId"],
            })
          }
        }
      }
    })
}

// Default registration schema (backward compatible)
export const registrationSchema = createRegistrationSchema()

export type RegistrationInput = z.infer<typeof registrationSchema>
