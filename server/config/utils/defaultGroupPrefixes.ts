/**
 * Canonical department / programme names and index-number prefixes (RMU defaults).
 * Keep in sync with `client/lib/rmu-departments.ts`.
 */
export const DEFAULT_RMU_GROUP_PREFIXES: Record<string, string[]> = {
  "Department of Transport": ["BLG", "BPS", "DPS"],
  "Nautical Science": ["BNS", "DNS"],
  "Computer Engineering": ["BEE", "DEE", "BCE"],
  "Information Technology": ["BIT", "DIT", "BCS"],
}

export function normalizeGroupPrefixesJson(value: unknown): Record<string, string[]> {
  if (value == null) return {}
  if (typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof k !== "string" || !k.trim()) continue
    if (Array.isArray(v)) {
      const strings = v
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
      if (strings.length > 0) out[k.trim()] = strings
    }
  }
  return out
}

/** Use stored tenant departments when configured; otherwise RMU defaults (dropdown + validation stay consistent). */
export function effectiveGroupPrefixes(stored: unknown): Record<string, string[]> {
  const parsed = normalizeGroupPrefixesJson(stored)
  return Object.keys(parsed).length > 0 ? parsed : DEFAULT_RMU_GROUP_PREFIXES
}
