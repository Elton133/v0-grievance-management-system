import { z } from "zod"

export const REGISTRATION_PASSWORD_HINT =
  "Use at least 8 characters with uppercase, lowercase, a number, and a symbol."

/** Keep rules in sync with `server/config/validation/passwordPolicy.ts`. */
export const registrationPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/\d/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol (e.g. !@#$%)")

export type PasswordStrengthCheck = { id: string; label: string; met: boolean }

/** Live feedback for the registration form (mirrors `registrationPasswordSchema` rules). */
export function getPasswordStrengthState(password: string): {
  checks: PasswordStrengthCheck[]
  score: number
  maxScore: number
  label: string
  barPercent: number
} {
  const checks: PasswordStrengthCheck[] = [
    { id: "len", label: "At least 8 characters", met: password.length >= 8 },
    { id: "lower", label: "One lowercase letter", met: /[a-z]/.test(password) },
    { id: "upper", label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { id: "num", label: "One number", met: /\d/.test(password) },
    { id: "sym", label: "One symbol (!@#$…)", met: /[^A-Za-z0-9]/.test(password) },
  ]
  const maxScore = checks.length
  const score = checks.filter((c) => c.met).length
  const barPercent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100)

  let label = "Enter a password"
  if (password.length > 0) {
    if (score <= 2) label = "Weak"
    else if (score < maxScore) label = "Good"
    else label = "Strong"
  }

  return { checks, score, maxScore, label, barPercent }
}
