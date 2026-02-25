import { z } from "zod"

// Group to index number prefix mapping
const DEPARTMENT_INDEX_PREFIXES: Record<string, string[]> = {
  ICT: ["BIT", "BCS", "BCE", "DIT"],
  Transport: ["BPS", "BLG", "DPS"],
  "Marine Electrical & Electronic Engineering": ["BEE", "BME"],
  "Nautical Science": ["BNS"],
}

// Remove static email checks, let the backend enforce `allowedEmailDomains`
const emailSchema = z.string().email("Invalid email format")

// Registration schema
export const registrationSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: emailSchema,
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    role: z.string(), // Removed enum to support dynamic CMS roles
    submitterId: z.string().optional(),
    group: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === "submitter") {
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
      if (data.role === "submitter") {
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
      if (data.role !== "submitter") {
        return !!data.group && data.group.trim().length > 0
      }
      return true
    },
    {
      message: "Group is required for staff members",
      path: ["group"],
    }
  )
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  // Moved prefix validation to backend, but we keep this refine empty for now to match types
  .superRefine((data, ctx) => {
    // Backend strictly enforces prefixes now
  })

export type RegistrationFormData = z.infer<typeof registrationSchema>

export { DEPARTMENT_INDEX_PREFIXES }

