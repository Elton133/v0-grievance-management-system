/**
 * Canonical department / programme names for RMU (used before settings load and as fallback).
 * Keep in sync with `server/config/utils/defaultGroupPrefixes.ts`.
 */
export const DEFAULT_RMU_GROUP_PREFIXES: Record<string, string[]> = {
  ICT: ["BIT", "BCS", "BCE", "DIT"],
  Transport: ["BPS", "BLG", "DPS"],
  "Marine Electrical & Electronic Engineering": ["BEE", "BME"],
  "Nautical Science": ["BNS"],
}

export function effectiveGroupPrefixes(stored: Record<string, string[]> | undefined | null): Record<string, string[]> {
  if (stored && Object.keys(stored).length > 0) return stored
  return DEFAULT_RMU_GROUP_PREFIXES
}

/** Sorted labels for Select components */
export function departmentSelectOptions(groupPrefixes: Record<string, string[]> | undefined | null): string[] {
  return Object.keys(effectiveGroupPrefixes(groupPrefixes)).sort((a, b) => a.localeCompare(b))
}
