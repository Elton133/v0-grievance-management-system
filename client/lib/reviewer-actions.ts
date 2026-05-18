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
    isHod: idx > 0 && idx < last,
    isRegistrar: idx === last,
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

/** Advisors/HODs forward with a comment; only Registrar resolves or rejects. */
export function getPetitionReviewActions(
  ticket: Ticket,
  userRole: string,
  rolesConfig?: RoleConfig[]
): ReviewAction[] {
  const { isAdvisor, isHod, isRegistrar } = getReviewerFlags(userRole, rolesConfig)
  const terminal = ["resolved", "rejected"]

  if (terminal.includes(ticket.status)) return []

  if (isAdvisor && (ticket.status === "submitted" || ticket.status === "under_review")) {
    return [
      {
        id: "fwd-hod",
        label: "Forward to Head of Department",
        status: "forwarded_to_hod",
        requiresComment: true,
        variant: "default",
        description: "Sends your comment to the HOD for the next review.",
      },
    ]
  }

  if (isHod && ticket.status === "forwarded_to_hod") {
    return [
      {
        id: "fwd-reg",
        label: "Forward to Registrar",
        status: "forwarded_to_registrar",
        requiresComment: true,
        variant: "default",
        description: "Sends your comment to the Registrar for a final decision.",
      },
    ]
  }

  if (isRegistrar && ticket.status === "forwarded_to_registrar") {
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
    if (actions[0].id === "fwd-hod") {
      return {
        title: "Your turn — Advisor review",
        steps: [
          "Read the student’s petition and any notes below.",
          "Write your comment (required) — the student and HOD will see it.",
          `Click “${actions[0].label}” when you are done. Do not use multiple buttons; forwarding is the final step for you.`,
        ],
      }
    }
    if (actions[0].id === "fwd-reg") {
      return {
        title: "Your turn — HOD review",
        steps: [
          "Read the advisor’s comments and the petition details.",
          "Write your comment (required) for the Registrar and student.",
          `Click “${actions[0].label}” to send the petition to the ${regLabel}.`,
        ],
      }
    }
    return {
      title: "Your turn — Final decision",
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
