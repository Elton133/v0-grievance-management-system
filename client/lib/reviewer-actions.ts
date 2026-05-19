import type { Ticket } from "@/lib/types"
import type { RoleConfig, TenantSettings } from "@/lib/settings-context"
import { WORKFLOW_STATUS_KEYS } from "@/lib/timeline-utils"

export type ReviewAction = {
  id: string
  label: string
  status: string
  requiresComment?: boolean
  variant?: "default" | "destructive" | "outline"
  description?: string
}

export type ReviewGuide = {
  title: string
  steps: string[]
  /** Shown when this role cannot act on the petition at its current status */
  readOnlyNote?: string
}

function getReviewers(rolesConfig: RoleConfig[] | undefined) {
  return (rolesConfig ?? [])
    .filter((r) => !r.isSubmitter && Number(r.level) > 0)
    .sort((a, b) => Number(a.level) - Number(b.level))
}

function getRegistrarLabel(rolesConfig: RoleConfig[] | undefined): string {
  const reviewers = getReviewers(rolesConfig)
  const reg =
    reviewers.find((r) => r.key === "registrar") ??
    reviewers[reviewers.length - 1]
  return reg?.label ?? "Registrar"
}

function getReviewerFlags(userRole: string, rolesConfig: RoleConfig[] | undefined) {
  const reviewers = getReviewers(rolesConfig)
  const idx = reviewers.findIndex((r) => r.key === userRole)
  const last = reviewers.length - 1

  if (idx < 0 || reviewers.length === 0) {
    return {
      isAdvisor: userRole === "advisor" || userRole === "class_advisor",
      isRegistrar: userRole === "registrar" || userRole === "hod",
    }
  }

  return {
    isAdvisor: idx === 0,
    isRegistrar: idx === last || userRole === "hod" || userRole === "registrar",
  }
}

function reviewerLabel(rolesConfig: RoleConfig[] | undefined, index: number, fallback: string) {
  return getReviewers(rolesConfig)[index]?.label ?? fallback
}

/** Who owns the petition at this workflow status (for read-only messages). */
export function getOwnerLabelForStatus(
  status: string,
  rolesConfig?: RoleConfig[]
): string {
  const registrar = getRegistrarLabel(rolesConfig)
  switch (status) {
    case "submitted":
    case "under_review":
      return reviewerLabel(rolesConfig, 0, "Advisor")
    case "forwarded_to_hod":
    case "forwarded_to_registrar":
      return registrar
    case "resolved":
      return "Completed"
    case "rejected":
      return "Closed"
    default:
      return "Reviewer"
  }
}

/** Advisors forward to Registrar; only Registrar resolves or rejects. */
export function getPetitionReviewActions(
  ticket: Ticket,
  userRole: string,
  rolesConfig?: RoleConfig[]
): ReviewAction[] {
  const { isAdvisor, isRegistrar } = getReviewerFlags(userRole, rolesConfig)
  const terminal = ["resolved", "rejected"]
  const regLabel = getRegistrarLabel(rolesConfig)

  if (terminal.includes(ticket.status)) return []

  if (isAdvisor && (ticket.status === "submitted" || ticket.status === "under_review")) {
    return [
      {
        id: "fwd-registrar",
        label: `Forward to ${regLabel}`,
        status: "forwarded_to_registrar",
        requiresComment: true,
        variant: "default",
        description: `Sends your comment to the ${regLabel} for review and final decision.`,
      },
    ]
  }

  if (
    isRegistrar &&
    (ticket.status === "forwarded_to_registrar" || ticket.status === "forwarded_to_hod")
  ) {
    return [
      {
        id: "resolve",
        label: "Approve & resolve",
        status: "resolved",
        variant: "default",
        description: "Marks the petition as resolved. Add an optional note for the student.",
      },
      {
        id: "reject",
        label: "Reject petition",
        status: "rejected",
        requiresComment: true,
        variant: "destructive",
        description: "Requires a clear reason — the student will see it.",
      },
    ]
  }

  return []
}

export function canUserReviewPetition(userRole: string, rolesConfig?: RoleConfig[]): boolean {
  const { isAdvisor, isRegistrar } = getReviewerFlags(userRole, rolesConfig)
  return isAdvisor || isRegistrar
}

export function canUserActOnPetition(
  ticket: Ticket,
  userRole: string,
  rolesConfig?: RoleConfig[]
): boolean {
  return getPetitionReviewActions(ticket, userRole, rolesConfig).length > 0
}

export function getPetitionReviewGuide(
  ticket: Ticket,
  userRole: string,
  rolesConfig?: RoleConfig[]
): ReviewGuide {
  const actions = getPetitionReviewActions(ticket, userRole, rolesConfig)
  const owner = getOwnerLabelForStatus(ticket.status, rolesConfig)
  const regLabel = getRegistrarLabel(rolesConfig)

  if (actions.length > 0) {
    if (actions[0].id === "fwd-registrar") {
      return {
        title: "Your turn — Advisor review",
        steps: [
          "Read the student’s petition and any notes below.",
          `Write your comment (required) — the student and ${regLabel} will see it.`,
          `Click “${actions[0].label}” when you are done. Do not use multiple buttons; forwarding is the final step for you.`,
        ],
      }
    }
    return {
      title: `Your turn — ${regLabel} decision`,
      steps: [
        "Read the advisor’s comments and the petition details.",
        "Add a note if helpful (required only when rejecting).",
        "Choose Approve & resolve or Reject petition.",
      ],
    }
  }

  const terminal = ["resolved", "rejected"]
  if (terminal.includes(ticket.status)) {
    return {
      title: "Petition closed",
      steps: [],
      readOnlyNote:
        ticket.status === "resolved"
          ? "This petition has been resolved. No further action is required."
          : "This petition was rejected. See the rejection reason in the details above.",
    }
  }

  return {
    title: "View only",
    steps: [],
    readOnlyNote: `This petition is currently with the ${owner}. You have already completed your step, or it is not assigned to your stage yet.`,
  }
}

/** Dynamic hint for timeline steps (avoids “Pending action” on completed stages). */
export function getTimelineStepHint(
  stepStatus: string,
  stepIndex: number,
  currentIndex: number,
  ticket: Ticket,
  settings: TenantSettings
): string | undefined {
  const terminal = ["resolved", "rejected"]

  if (terminal.includes(ticket.status) && stepIndex === currentIndex) {
    return ticket.status === "resolved"
      ? "Petition approved and closed"
      : "Petition rejected and closed"
  }

  if (stepIndex < currentIndex) {
    const entry = [...(ticket.statusHistory ?? [])]
      .filter((h) => h.newStatus === stepStatus)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())[0]
    if (entry) {
      return `Done · ${entry.changedByName} (${entry.changedByRole}) · ${entry.changedAt.toLocaleDateString()}`
    }
    return "Done"
  }

  if (stepIndex === currentIndex) {
    if (stepStatus === "submitted") {
      return `Awaiting ${getOwnerLabelForStatus("under_review", settings.rolesConfig)}`
    }
    const owner = getOwnerLabelForStatus(stepStatus, settings.rolesConfig)
    return `In progress · waiting on ${owner}`
  }

  const nextKey = WORKFLOW_STATUS_KEYS[stepIndex]
  if (nextKey) {
    return `Up next · ${getOwnerLabelForStatus(nextKey, settings.rolesConfig)}`
  }

  return undefined
}
