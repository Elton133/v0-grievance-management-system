/**
 * Canonical department / programme names for RMU (used before settings load and as fallback).
 * Keep in sync with `server/config/utils/defaultGroupPrefixes.ts`.
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

export function effectiveGroupPrefixes(stored: Record<string, string[]> | undefined | null): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...DEFAULT_RMU_GROUP_PREFIXES }
  if (stored) {
    for (const [k, v] of Object.entries(stored)) {
      merged[k] = v
    }
  }
  return merged
}

/** Sorted labels for Select components */
export function departmentSelectOptions(groupPrefixes: Record<string, string[]> | undefined | null): string[] {
  return Object.keys(effectiveGroupPrefixes(groupPrefixes)).sort((a, b) => a.localeCompare(b))
}
