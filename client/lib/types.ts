export type TicketType = string

export type TicketStatus = string

export type TicketPriority = "low" | "medium" | "high" | "urgent"

export interface Ticket {
  id: string
  referenceCode?: string
  submitterId: string
  submitterIndexNumber?: string
  submitterName: string
  submitterEmail: string
  group: string
  year: string
  type: TicketType
  priority: TicketPriority
  subject: string
  description: string
  attachments?: PetitionAttachment[]
  status: TicketStatus
  submittedAt: Date
  updatedAt: Date
  firstResponseAt?: Date
  resolvedAt?: Date
  lastStatusChangedAt?: Date
  /** Assignee email (or legacy string) for display */
  assignedTo?: string
  /** User id of assignee when API provides FK / assignedUser */
  assignedToUserId?: string
  /** Display name when API returns assignedUser */
  assignedUserName?: string
  comments?: TicketComment[]
  statusHistory?: TicketStatusHistoryEntry[]
  escalationLevel: number
}

export interface TicketStatusHistoryEntry {
  id: string
  previousStatus: string | null
  newStatus: string
  changedByName: string
  changedByRole: string
  comment?: string | null
  changedAt: Date
}

export interface PetitionAttachment {
  id: string
  fileName: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  uploadedAt: Date
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
