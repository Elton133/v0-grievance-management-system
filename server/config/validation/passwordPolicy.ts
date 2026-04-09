import { z } from "zod"

export const REGISTRATION_PASSWORD_HINT =
  "Use at least 8 characters with uppercase, lowercase, a number, and a symbol."

/** Registration / password change — enforced on server and mirrored on the client form. */
export const registrationPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/\d/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol (e.g. !@#$%)")
