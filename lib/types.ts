export type PetitionType =
  | "academic_issue"
  | "administrative_issue"
  | "facility_issue"
  | "disciplinary_issue"
  | "financial_issue"
  | "other"

export type PetitionStatus =
  | "submitted"
  | "under_review"
  | "forwarded_to_hod"
  | "forwarded_to_registrar"
  | "resolved"
  | "rejected"

export type PetitionPriority = "low" | "medium" | "high" | "urgent"

export interface Petition {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  department: string
  year: string
  type: PetitionType
  priority: PetitionPriority
  subject: string
  description: string
  attachments?: string[]
  status: PetitionStatus
  submittedAt: Date
  updatedAt: Date
  assignedTo?: string
  comments?: PetitionComment[]
  escalationLevel: number
}

export interface PetitionComment {
  id: string
  petitionId: string
  authorId: string
  authorName: string
  authorRole: string
  content: string
  createdAt: Date
  isInternal: boolean
}
