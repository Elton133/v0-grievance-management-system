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

export function getReviewers(rolesConfig: RoleConfig[] | undefined) {
  return (rolesConfig ?? [])
    .filter((r) => !r.isSubmitter && Number(r.level) > 0)
    .sort((a, b) => Number(a.level) - Number(b.level))
}

/** True when workflow includes a middle HOD step (advisor → HOD → registrar). */
export function usesHodStep(rolesConfig?: RoleConfig[]): boolean {
  return getReviewers(rolesConfig).length >= 3
}

export function getAdvisorForwardStatus(rolesConfig?: RoleConfig[]): string {
  return usesHodStep(rolesConfig) ? "forwarded_to_hod" : "forwarded_to_registrar"
}

export function isStaffReviewerRole(userRole: string, rolesConfig?: RoleConfig[]): boolean {
  if (["advisor", "class_advisor", "hod", "registrar"].includes(userRole)) return true
  return getReviewers(rolesConfig).some((r) => r.key === userRole)
}

function getReviewerFlags(userRole: string, rolesConfig: RoleConfig[] | undefined) {
  const reviewers = getReviewers(rolesConfig)
  const idx = reviewers.findIndex((r) => r.key === userRole)
  const last = reviewers.length - 1

  if (idx < 0 || reviewers.length === 0) {
    return {
      isAdvisor: userRole === "advisor" || userRole === "class_advisor",
      isHod: userRole === "hod",
      isRegistrar: userRole === "registrar",
    }
  }

  return {
    isAdvisor: idx === 0,
    isHod: userRole === "hod" || (idx > 0 && idx < last && userRole !== "registrar"),
    isRegistrar:
      userRole === "registrar" || (idx === last && userRole !== "hod"),
  }
}

/** Final approve/reject: registrar role only, and only after HOD has forwarded. */
function canRegistrarFinalize(
  userRole: string,
  ticketStatus: string,
  rolesConfig?: RoleConfig[]
): boolean {
  if (ticketStatus !== "forwarded_to_registrar") return false
  if (userRole === "hod" || userRole === "advisor" || userRole === "class_advisor") return false
  if (userRole === "registrar") return true
  const reviewers = getReviewers(rolesConfig)
  const last = reviewers[reviewers.length - 1]
  return last?.key === userRole
}

function reviewerLabel(rolesConfig: RoleConfig[] | undefined, index: number, fallback: string) {
  return getReviewers(rolesConfig)[index]?.label ?? fallback
}

/** Who owns the petition at this workflow status (for read-only messages). */
export function getOwnerLabelForStatus(
  status: string,
  rolesConfig?: RoleConfig[]
): string {
  switch (status) {
    case "submitted":
    case "under_review":
      return reviewerLabel(rolesConfig, 0, "Advisor")
    case "forwarded_to_hod":
      return reviewerLabel(rolesConfig, 1, "Head of Department")
    case "forwarded_to_registrar":
      return reviewerLabel(rolesConfig, 2, "Registrar")
    case "resolved":
      return "Completed"
    case "rejected":
      return "Closed"
    default:
      return "Reviewer"
  }
}

/** Advisors and HOD forward with a comment; only Registrar resolves or rejects. */
export function getPetitionReviewActions(
  ticket: Ticket,
  userRole: string,
  rolesConfig?: RoleConfig[]
): ReviewAction[] {
  const { isAdvisor, isHod, isRegistrar } = getReviewerFlags(userRole, rolesConfig)
  const terminal = ["resolved", "rejected"]
  const hodLabel = reviewerLabel(rolesConfig, 1, "Head of Department")
  const regLabel = reviewerLabel(rolesConfig, 2, "Registrar")

  if (terminal.includes(ticket.status)) return []

  if (isAdvisor && (ticket.status === "submitted" || ticket.status === "under_review")) {
    const forwardStatus = getAdvisorForwardStatus(rolesConfig)
    const forwardLabel =
      forwardStatus === "forwarded_to_hod" ? hodLabel : regLabel
    return [
      {
        id: forwardStatus === "forwarded_to_hod" ? "fwd-hod" : "fwd-registrar",
        label: `Forward to ${forwardLabel}`,
        status: forwardStatus,
        requiresComment: true,
        variant: "default",
        description: `Sends your comment to the ${forwardLabel} for the next review.`,
      },
    ]
  }

  if (
    (userRole === "hod" || isHod) &&
    ticket.status === "forwarded_to_hod"
  ) {
    return [
      {
        id: "fwd-registrar",
        label: `Forward to ${regLabel}`,
        status: "forwarded_to_registrar",
        requiresComment: true,
        variant: "default",
        description: `Sends your comment to the ${regLabel} for a final decision. You cannot approve or reject at this stage.`,
      },
    ]
  }

  if (canRegistrarFinalize(userRole, ticket.status, rolesConfig)) {
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
  if (!isStaffReviewerRole(userRole, rolesConfig)) return false
  const { isAdvisor, isHod, isRegistrar } = getReviewerFlags(userRole, rolesConfig)
  return isAdvisor || isHod || isRegistrar
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
  const hodLabel = reviewerLabel(rolesConfig, 1, "Head of Department")
  const regLabel = reviewerLabel(rolesConfig, 2, "Registrar")

  if (actions.length > 0) {
    if (actions[0].id === "fwd-hod" || (actions[0].id === "fwd-registrar" && !usesHodStep(rolesConfig))) {
      const nextLabel = usesHodStep(rolesConfig) ? hodLabel : regLabel
      return {
        title: "Your turn — Advisor review",
        steps: [
          "Read the student’s petition and any notes below.",
          `Write your comment (required) — the student and ${nextLabel} will see it.`,
          `Click “${actions[0].label}” when you are done. Forwarding is the final step for you.`,
        ],
      }
    }
    if (actions[0].id === "fwd-registrar" && userRole === "hod") {
      return {
        title: `Your turn — ${hodLabel} review`,
        steps: [
          "Read the advisor’s comments and the petition details.",
          `Write your comment (required) for the ${regLabel} and student.`,
          `Click “${actions[0].label}” when you are done. You cannot approve or reject — only the ${regLabel} can close the petition.`,
        ],
      }
    }
    return {
      title: `Your turn — ${regLabel} decision`,
      steps: [
        "Read all advisor and HOD comments below.",
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

  if (
    userRole === "registrar" &&
    ticket.status === "forwarded_to_hod"
  ) {
    return {
      title: "Waiting on Head of Department",
      steps: [],
      readOnlyNote: `This petition is with the ${hodLabel}. They must add comments and forward it to you before you can approve or reject.`,
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
