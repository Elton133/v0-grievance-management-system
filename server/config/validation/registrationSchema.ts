import { z } from "zod"

// Default group to index number prefix mapping (RMU defaults)
// These can be overridden via TenantSettings.groupPrefixes
const DEFAULT_DEPARTMENT_INDEX_PREFIXES: Record<string, string[]> = {
  ICT: ["BIT", "BCS", "BCE", "DIT"],
  Transport: ["BPS", "BLG", "DPS"],
  "Marine Electrical & Electronic Engineering": ["BEE", "BME"],
  "Nautical Science": ["BNS"],
}

// Default valid email domains
// Empty array means: no domain restriction by default.
// Tenants can still enforce domains via TenantSettings.allowedEmailDomains.
const DEFAULT_EMAIL_DOMAINS: string[] = []

// Default valid roles
const DEFAULT_ROLES = ["submitter", "class_advisor", "hod", "registrar"]

// Index number validation based on group
const validateIndexNumber = (indexNumber: string, group: string, prefixes?: Record<string, string[]>): boolean => {
  const deptPrefixes = (prefixes || DEFAULT_DEPARTMENT_INDEX_PREFIXES)[group]
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
}) => {
  const emailDomains = tenantSettings?.allowedEmailDomains?.length
    ? tenantSettings.allowedEmailDomains
    : DEFAULT_EMAIL_DOMAINS

  const validRoles = tenantSettings?.roles?.length
    ? tenantSettings.roles
    : DEFAULT_ROLES

  const submitterRole = tenantSettings?.submitterRoleKey || "submitter"

  const deptPrefixes = tenantSettings?.groupPrefixes || DEFAULT_DEPARTMENT_INDEX_PREFIXES

  // Email validation – allow all domains if settings have empty array or no domains
  const emailSchema = emailDomains.length > 0
    ? z
      .string()
      .email("Invalid email format")
      .refine(
        (email) => emailDomains.some((domain) => email.endsWith(domain)),
        {
          message: `Email must be from one of: ${emailDomains.join(", ")}`,
        }
      )
    : z.string().email("Invalid email format")

  return z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: emailSchema,
      password: z.string().min(6, "Password must be at least 6 characters"),
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
        message: "Group is required for submitters",
        path: ["group"],
      }
    )
    .refine(
      (data) => {
        if (data.role !== submitterRole) {
          return !!data.group && data.group.trim().length > 0
        }
        return true
      },
      {
        message: "Group is required for staff members",
        path: ["group"],
      }
    )
    .superRefine((data, ctx) => {
      if (data.role === submitterRole && data.submitterId && data.group) {
        // Only validate index number if group prefixes exist for this group
        const hasPrefixes = Object.keys(deptPrefixes).length > 0
        if (hasPrefixes && !validateIndexNumber(data.submitterId, data.group, deptPrefixes)) {
          const prefixes = deptPrefixes[data.group] || []
          if (prefixes.length > 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Submitter ID must start with one of: ${prefixes.join(", ")} for ${data.group} group`,
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
