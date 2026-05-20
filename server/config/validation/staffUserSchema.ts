import { z } from "zod"
import { registrationPasswordSchema } from "./passwordPolicy"
import { normalizeAllowedEmailDomains } from "../utils/allowedEmailDomains"
import { effectiveGroupPrefixes } from "../utils/defaultGroupPrefixes"

type RoleConfig = { key: string; isSubmitter?: boolean; groupScoped?: boolean }

export function createStaffUserSchema(tenantSettings?: {
  allowedEmailDomains?: string[]
  rolesConfig?: RoleConfig[]
  groupPrefixes?: Record<string, string[]>
}) {
  const rolesConfig = tenantSettings?.rolesConfig?.length
    ? tenantSettings.rolesConfig
    : [
        { key: "advisor", groupScoped: true },
        { key: "hod", groupScoped: true },
        { key: "registrar", groupScoped: false },
      ]

  const staffRoleKeys = rolesConfig.filter((r) => r.isSubmitter !== true).map((r) => r.key)

  const emailDomains = normalizeAllowedEmailDomains(tenantSettings?.allowedEmailDomains)
  const normalizedDomains = (emailDomains.length > 0 ? emailDomains : ["st.rmu.edu.gh", "rmu.edu.gh"])
    .map((d) => d.trim().toLowerCase().replace(/^@+/, ""))
    .filter(Boolean)

  const hostMatchesAllowedDomain = (email: string, domain: string): boolean => {
    const at = email.lastIndexOf("@")
    if (at < 0) return false
    const host = email.slice(at + 1).toLowerCase()
    const d = domain.toLowerCase()
    return host === d || host.endsWith(`.${d}`)
  }

  const emailSchema =
    normalizedDomains.length > 0
      ? z
          .string()
          .email("Invalid email format")
          .refine(
            (email) => normalizedDomains.some((domain) => hostMatchesAllowedDomain(email, domain)),
            { message: `Email must be from one of: ${normalizedDomains.join(", ")}` }
          )
      : z.string().email("Invalid email format")

  const deptPrefixes = effectiveGroupPrefixes(tenantSettings?.groupPrefixes)
  const allowedDepartments = Object.keys(deptPrefixes)

  const staffRoleRequiresGroup = (role: string): boolean => {
    const rc = rolesConfig.find((r) => r.key === role)
    if (rc !== undefined) return rc.groupScoped !== false
    return role !== "registrar"
  }

  return z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: emailSchema,
      password: registrationPasswordSchema,
      role: z.string().refine((val) => staffRoleKeys.includes(val), {
        message: `Role must be one of: ${staffRoleKeys.join(", ")}`,
      }),
      group: z.string().optional(),
    })
    .refine(
      (data) => {
        if (!staffRoleRequiresGroup(data.role)) return true
        return !!data.group && data.group.trim().length > 0
      },
      { message: "Department is required for this role", path: ["group"] }
    )
    .refine(
      (data) => {
        if (!staffRoleRequiresGroup(data.role)) return true
        const g = data.group?.trim()
        if (!g) return true
        if (allowedDepartments.length === 0) return true
        return allowedDepartments.includes(g)
      },
      { message: "Choose a department from the list", path: ["group"] }
    )
}

export type StaffUserInput = z.infer<ReturnType<typeof createStaffUserSchema>>
