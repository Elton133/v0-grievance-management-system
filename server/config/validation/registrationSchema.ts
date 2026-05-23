import { z } from "zod"
import { registrationPasswordSchema } from "./passwordPolicy"
import { normalizeAllowedEmailDomains } from "../utils/allowedEmailDomains"
import { effectiveGroupPrefixes } from "../utils/defaultGroupPrefixes"

const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["st.rmu.edu.gh", "rmu.edu.gh"]

/** Roles allowed on the public registration form (never staff roles). */
function getPublicRegistrationRoleKeys(
  rolesConfig?: Array<{ key: string; isSubmitter?: boolean }>
): string[] {
  const keys = new Set<string>(["student", "alumni"])
  for (const r of rolesConfig ?? []) {
    if (r.isSubmitter === true || r.key === "student") {
      keys.add(r.key)
    }
  }
  // Legacy tenants used "submitter" as the student role key
  if (rolesConfig?.some((r) => r.key === "submitter" && r.isSubmitter)) {
    keys.add("submitter")
  }
  return Array.from(keys)
}

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

  const rolesConfig = tenantSettings?.rolesConfig
  const validRoles = getPublicRegistrationRoleKeys(rolesConfig)

  const submitterRole =
    rolesConfig?.find((r) => r.key === "student")?.key ??
    rolesConfig?.find((r) => r.isSubmitter)?.key ??
    tenantSettings?.submitterRoleKey ??
    "student"

  const deptPrefixes = effectiveGroupPrefixes(tenantSettings?.groupPrefixes)
  const allowedDepartments = Object.keys(deptPrefixes)

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

  const isMemberRole = (role: string) =>
    role === "student" || role === submitterRole

  return z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: z.string().email("Invalid email format"),
      password: registrationPasswordSchema,
      role: z.string().refine((val) => validRoles.includes(val), {
        message: `Role must be one of: ${validRoles.join(", ")}`,
      }).default(submitterRole),
      submitterId: z.string().optional(),
      group: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      // Alumni have graduated and use personal emails — skip domain restriction
      if (data.role === "alumni") return
      if (normalizedDomains.length === 0) return
      if (!normalizedDomains.some((domain) => hostMatchesAllowedDomain(data.email, domain))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Email must be from one of: ${normalizedDomains.join(", ")}`,
          path: ["email"],
        })
      }
    })
    .refine(
      (data) => {
        if (isMemberRole(data.role)) {
          return !!data.submitterId && data.submitterId.trim().length > 0
        }
        return true
      },
      {
        message: "ID is required",
        path: ["submitterId"],
      }
    )
    .refine(
      (data) => {
        if (isMemberRole(data.role)) {
          return !!data.group && data.group.trim().length > 0
        }
        return true
      },
      {
        message: "Department is required",
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
      // Alumni mapping uses the student branch
      if (isMemberRole(data.role) && data.submitterId && data.group) {
        if (!validateIndexNumber(data.submitterId, data.group, deptPrefixes)) {
          const prefixes = deptPrefixes[data.group] || []
          if (prefixes.length > 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Student ID must start with one of: ${prefixes.join(", ")} for ${data.group}`,
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
