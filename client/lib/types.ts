export type TicketType =
  | "academic_issue"
  | "administrative_issue"
  | "facility_issue"
  | "disciplinary_issue"
  | "financial_issue"
  | "other"

export type TicketStatus =
  | "submitted"
  | "under_review"
  | "forwarded_to_hod"
  | "forwarded_to_registrar"
  | "resolved"
  | "rejected"

export type TicketPriority = "low" | "medium" | "high" | "urgent"

export interface Ticket {
  id: string
  submitterId: string
  submitterName: string
  submitterEmail: string
  group: string
  year: string
  type: TicketType
  priority: TicketPriority
  subject: string
  description: string
  attachments?: string[]
  status: TicketStatus
  submittedAt: Date
  updatedAt: Date
  assignedTo?: string
  comments?: TicketComment[]
  escalationLevel: number
}

export interface TicketComment {
  id: string
  ticketId: string
  authorId: string
  authorName: string
  authorRole: string
  content: string
  createdAt: Date
  isInternal: boolean
}
