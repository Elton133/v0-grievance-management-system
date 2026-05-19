/** Keep in sync with server/config/utils/workflowLabels.ts */
export const WORKFLOW_ROLE_LABELS: Record<string, string> = {
  student: "Student",
  advisor: "Class Advisor",
  class_advisor: "Class Advisor",
  hod: "Registrar",
  registrar: "Registrar",
}

export function formatWorkflowRole(roleKey: string): string {
  if (!roleKey) return "Staff"
  return (
    WORKFLOW_ROLE_LABELS[roleKey] ??
    roleKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
