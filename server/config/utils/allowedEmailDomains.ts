/**
 * Normalize TenantSettings.allowedEmailDomains from DB (jsonb) into a string[].
 * Handles: JSON array, a single JSON string value, or a stringified JSON array.
 */
export function normalizeAllowedEmailDomains(value: unknown): string[] {
  if (value == null) return []

  if (Array.isArray(value)) {
    return value
      .filter((x): x is string => typeof x === "string")
      .map((d) => d.trim().toLowerCase().replace(/^@+/, ""))
      .filter(Boolean)
  }

  if (typeof value === "string") {
    const s = value.trim()
    if (!s) return []
    if (s.startsWith("[")) {
      try {
        return normalizeAllowedEmailDomains(JSON.parse(s) as unknown)
      } catch {
        return [s.toLowerCase().replace(/^@+/, "")]
      }
    }
    return [s.toLowerCase().replace(/^@+/, "")]
  }

  return []
}
