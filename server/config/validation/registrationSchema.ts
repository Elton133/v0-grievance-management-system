import { z } from "zod"

// Department to index number prefix mapping
const DEPARTMENT_INDEX_PREFIXES: Record<string, string[]> = {
  ICT: ["BIT", "BCS", "BCE", "DIT"],
  Transport: ["BPS", "BLG", "DPS"],
  "Marine Electrical & Electronic Engineering": ["BEE", "BME"],
  "Nautical Science": ["BNS"],
}

// Valid RMU email domains
const RMU_EMAIL_DOMAINS = ["@st.rmu.edu.gh", "@rmu.edu.gh"]

// Email validation schema
const emailSchema = z
  .string()
  .email("Invalid email format")
  .refine(
    (email) => RMU_EMAIL_DOMAINS.some((domain) => email.endsWith(domain)),
    {
      message: "Email must be from @st.rmu.edu.gh or @rmu.edu.gh domain",
    }
  )

// Index number validation based on department
const validateIndexNumber = (indexNumber: string, department: string): boolean => {
  const prefixes = DEPARTMENT_INDEX_PREFIXES[department]
  if (!prefixes) return false
  return prefixes.some((prefix) => indexNumber.toUpperCase().startsWith(prefix))
}

// Registration schema
export const registrationSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: emailSchema,
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["student", "class_advisor", "hod", "registrar"]).default("student"),
    studentId: z.string().optional(),
    department: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === "student") {
        return !!data.studentId && data.studentId.trim().length > 0
      }
      return true
    },
    {
      message: "Student ID is required for students",
      path: ["studentId"],
    }
  )
  .refine(
    (data) => {
      if (data.role === "student") {
        return !!data.department && data.department.trim().length > 0
      }
      return true
    },
    {
      message: "Department is required for students",
      path: ["department"],
    }
  )
  .refine(
    (data) => {
      if (data.role !== "student") {
        return !!data.department && data.department.trim().length > 0
      }
      return true
    },
    {
      message: "Department is required for staff members",
      path: ["department"],
    }
  )
  .superRefine((data, ctx) => {
    if (data.role === "student" && data.studentId && data.department) {
      if (!validateIndexNumber(data.studentId, data.department)) {
        const prefixes = DEPARTMENT_INDEX_PREFIXES[data.department] || []
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Student ID must start with one of: ${prefixes.join(", ")} for ${data.department} department`,
          path: ["studentId"],
        })
      }
    }
  })

export type RegistrationInput = z.infer<typeof registrationSchema>

