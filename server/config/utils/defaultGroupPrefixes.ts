/**
 * Department / programme groups and student index-number prefixes (RMU).
 * Students select a department at registration; index prefixes validate Student ID.
 * Keep in sync with `client/lib/rmu-departments.ts`.
 *
 * Note: Many programmes share the BIT prefix (e.g. IT regular & weekend). Use roster
 * name matching when prefix alone is not enough.
 */
export const DEFAULT_RMU_GROUP_PREFIXES: Record<string, string[]> = {
  "Information Technology": ["BIT", "DIT", "BCS"],
  "Nautical Science Department": ["BNS", "DNS", "GPR"],
  "Marine Engineering Department": ["BME", "DME", "BOC", "BNA"],
  "Mechanical Engineering": ["BSME", "BSMEC"],
  "Computer Engineering": ["BEE", "DEE", "BCE"],
  "Department of Transport": ["BLG", "BPS", "DPS"],
  "Postgraduate Programmes": ["MSC", "MEV", "MSE", "MCM"],
  "Vocational Programmes": ["VOC", "MEM", "SCW", "RAC", "WLD", "PIA"],
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

/** Stored tenant departments merged with defaults so new schools appear without wiping custom entries. */
export function effectiveGroupPrefixes(stored: unknown): Record<string, string[]> {
  const parsed = normalizeGroupPrefixesJson(stored)
  const merged: Record<string, string[]> = { ...DEFAULT_RMU_GROUP_PREFIXES }
  for (const [k, v] of Object.entries(parsed)) {
    merged[k] = v
  }
  return Object.keys(merged).length > 0 ? merged : DEFAULT_RMU_GROUP_PREFIXES
}
