import type { Ticket, TicketComment, TicketStatusHistoryEntry } from "@/lib/types"
import { formatWorkflowRole } from "@/lib/workflow-labels"

export type ActivityItem = {
  id: string
  kind: "status" | "comment"
  at: Date
  title: string
  actorName: string
  actorRole: string
  body?: string | null
}

function norm(s: string) {
  return s.trim().toLowerCase()
}

/** Skip comments duplicated in an adjacent status-change entry (same author + text). */
function isCommentDuplicatedInHistory(
  comment: TicketComment,
  history: TicketStatusHistoryEntry[]
): boolean {
  const content = norm(comment.content)
  return history.some((h) => {
    if (!h.comment || norm(h.comment) !== content) return false
    if (norm(h.changedByName) !== norm(comment.authorName)) return false
    const dt = Math.abs(h.changedAt.getTime() - comment.createdAt.getTime())
    return dt < 15000
  })
}

export function buildActivityFeed(
  ticket: Ticket,
  getStatusLabel: (key: string) => string
): ActivityItem[] {
  const history = [...(ticket.statusHistory ?? [])].sort(
    (a, b) => a.changedAt.getTime() - b.changedAt.getTime()
  )
  const comments = [...(ticket.comments ?? [])].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )

  const items: ActivityItem[] = []

  const hasSubmitEvent = history.some((h) => !h.previousStatus && h.newStatus === "submitted")

  for (const h of history) {
    const title = formatStatusTitle(h, getStatusLabel)
    const roleLabel = formatWorkflowRole(h.changedByRole)
    items.push({
      id: `status-${h.id}`,
      kind: "status",
      at: h.changedAt,
      title: `${title} — ${roleLabel}`,
      actorName: h.changedByName,
      actorRole: roleLabel,
      body: h.comment,
    })
  }

  if (!hasSubmitEvent && ticket.submittedAt) {
    items.push({
      id: `synthetic-submit-${ticket.id}`,
      kind: "status",
      at: ticket.submittedAt,
      title: "Petition submitted",
      actorName: ticket.submitterName,
      actorRole: "student",
    })
  }

  for (const c of comments) {
    if (isCommentDuplicatedInHistory(c, history)) continue
    const roleLabel = formatWorkflowRole(c.authorRole)
    items.push({
      id: `comment-${c.id}`,
      kind: "comment",
      at: c.createdAt,
      title: `Comment — ${roleLabel}`,
      actorName: c.authorName,
      actorRole: roleLabel,
      body: c.content,
    })
  }

  return items.sort((a, b) => a.at.getTime() - b.at.getTime())
}

function formatStatusTitle(
  h: TicketStatusHistoryEntry,
  getStatusLabel: (key: string) => string
): string {
  if (h.previousStatus == null || h.previousStatus === "") {
    return "Petition submitted"
  }
  const to = getStatusLabel(h.newStatus)
  switch (h.newStatus) {
    case "under_review":
      return "Review started"
    case "forwarded_to_hod":
      return "Forwarded to Head of Department"
    case "forwarded_to_registrar":
      return "Forwarded to Registrar"
    case "resolved":
      return "Petition resolved"
    case "rejected":
      return "Petition rejected"
    default:
      return `${getStatusLabel(h.previousStatus)} → ${to}`
  }
}
