import type { TenantSettings } from "@/lib/settings-context"

/** Workflow status keys in order (must match server escalation). */
export const WORKFLOW_STATUS_KEYS = [
  "submitted",
  "under_review",
  "forwarded_to_hod",
  "forwarded_to_registrar",
] as const

const TERMINAL_KEYS = ["resolved", "rejected"] as const

export type TimelineStep = {
  status: string
  label: string
  color: string
  actorHint?: string
}

/**
 * Build timeline steps from school actors (roles) + status labels.
 * Maps each workflow stage to the corresponding reviewer role where applicable.
 */
export function buildActorTimelineSteps(settings: TenantSettings): TimelineStep[] {
  const roles = settings.rolesConfig ?? []
  const statusLabels = settings.statusLabelsConfig ?? []

  const submitter = roles.find((r) => r.isSubmitter)
  const reviewers = roles
    .filter((r) => !r.isSubmitter && r.level > 0)
    .sort((a, b) => a.level - b.level)

  const meta = (key: string) => statusLabels.find((s) => s.key === key)

  const steps: TimelineStep[] = []

  WORKFLOW_STATUS_KEYS.forEach((key, idx) => {
    const sc = meta(key)
    const color = sc?.color ?? "#64748b"
    if (idx === 0) {
      const actor = submitter?.label ?? "Student"
      steps.push({
        status: key,
        label: sc?.label ?? "Submitted",
        color,
        actorHint: `${actor} — grievance received`,
      })
      return
    }
    const reviewer = reviewers[idx - 1]
    const base = sc?.label ?? key.replace(/_/g, " ")
    steps.push({
      status: key,
      label: reviewer ? `${reviewer.label}` : base,
      color,
      actorHint: reviewer ? `${reviewer.label} review` : base,
    })
  })

  TERMINAL_KEYS.forEach((key) => {
    const sc = meta(key)
    if (sc) {
      steps.push({
        status: key,
        label: sc.label,
        color: sc.color,
        actorHint: key === "resolved" ? "Grievance closed — resolved" : "Grievance closed — rejected",
      })
    }
  })

  return steps
}
