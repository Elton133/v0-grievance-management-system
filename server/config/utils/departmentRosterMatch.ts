/**
 * Treats common school/tenant label variants as the same department for roster vs form.
 * Keep in sync with `client/lib/departmentRosterMatch.ts`.
 */

function normDept(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/&/g, "and")
    .replace(/\./g, "")
}

/** Known label groups: any two labels in the same set match for roster purposes. */
const DEPARTMENT_EQUIVALENCE: ReadonlyArray<ReadonlySet<string>> = [
  new Set([
    "ict",
    "it",
    "information technology",
    "department of ict",
    "department of information technology",
  ]),
  new Set(["transport", "department of transport"]),
  new Set(["nautical science", "department of nautical science"]),
  new Set(["computer engineering", "marine electrical and electronic engineering"]),
]

function bucketFor(dept: string): string | null {
  const n = normDept(dept)
  for (let i = 0; i < DEPARTMENT_EQUIVALENCE.length; i++) {
    if (DEPARTMENT_EQUIVALENCE[i].has(n)) return `eq:${i}`
  }
  return null
}

/** True when the selected department and roster row department refer to the same programme. */
export function departmentsEquivalentForRoster(a: string | undefined, b: string | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false
  const na = normDept(a)
  const nb = normDept(b)
  if (na === nb) return true
  const ba = bucketFor(a)
  const bb = bucketFor(b)
  return ba !== null && ba === bb
}
