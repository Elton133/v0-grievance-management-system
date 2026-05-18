/** University petition form options (keep labels aligned with server defaults). */

export const PETITION_TYPES = [
  { key: "fee_issues", label: "Fee issues" },
  { key: "results_issues", label: "Results issues" },
] as const

export const PETITION_SUBJECTS = [
  { key: "results_not_showing", label: "Results not showing" },
  { key: "fees_not_reflecting", label: "Fees not reflecting" },
  { key: "other", label: "Other" },
] as const

export const ACADEMIC_LEVELS = [
  { value: "L100", label: "Level 100 (L100)" },
  { value: "L200", label: "Level 200 (L200)" },
  { value: "L300", label: "Level 300 (L300)" },
  { value: "L400", label: "Level 400 (L400)" },
] as const

export function petitionSubjectLabel(key: string): string {
  return PETITION_SUBJECTS.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ")
}

export function petitionTypeLabel(key: string): string {
  return PETITION_TYPES.find((t) => t.key === key)?.label ?? key.replace(/_/g, " ")
}
