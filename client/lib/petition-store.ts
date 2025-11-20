"use client"

import type { Petition, PetitionStatus, PetitionComment } from "./types"
import { createStatusUpdateNotification } from "./notification-store"
import { addAuditLog } from "./analytics-store"

// Mock data store - in real app this would be a database
const petitions: Petition[] = [
  {
    id: "PET-2024-001",
    studentId: "ST2024001",
    studentName: "John Doe",
    studentEmail: "student@university.edu",
    department: "Computer Science",
    year: "3rd Year",
    type: "academic_issue",
    priority: "medium",
    subject: "Grade Discrepancy in Data Structures Course",
    description:
      "I believe there was an error in the calculation of my final grade for the Data Structures course. My internal assessment scores don't match the final grade awarded.",
    status: "under_review",
    submittedAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-16"),
    escalationLevel: 1,
    assignedTo: "advisor@university.edu",
  },
  {
    id: "PET-2024-002",
    studentId: "ST2024002",
    studentName: "Jane Smith",
    studentEmail: "jane.smith@university.edu",
    department: "Computer Science",
    year: "2nd Year",
    type: "facility_issue",
    priority: "high",
    subject: "Library Computer Lab Issues",
    description:
      "The computers in the library lab are frequently crashing and preventing students from completing assignments.",
    status: "forwarded_to_hod",
    submittedAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-12"),
    escalationLevel: 2,
    assignedTo: "hod@university.edu",
  },
  {
    id: "PET-2024-003",
    studentId: "ST2024003",
    studentName: "Mike Johnson",
    studentEmail: "mike.johnson@university.edu",
    department: "Computer Science",
    year: "4th Year",
    type: "administrative_issue",
    priority: "urgent",
    subject: "Transcript Processing Delay",
    description: "My transcript has been pending for over 3 weeks, affecting my job application deadlines.",
    status: "forwarded_to_registrar",
    submittedAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-08"),
    escalationLevel: 3,
    assignedTo: "registrar@university.edu",
  },
]

export function submitPetition(
  petitionData: Omit<Petition, "id" | "submittedAt" | "updatedAt" | "status" | "escalationLevel">,
): Petition {
  const newPetition: Petition = {
    ...petitionData,
    id: `PET-2024-${String(petitions.length + 1).padStart(3, "0")}`,
    status: "submitted",
    submittedAt: new Date(),
    updatedAt: new Date(),
    escalationLevel: 1,
  }

  petitions.push(newPetition)

  addAuditLog({
    userId: petitionData.studentId,
    userRole: "student",
    action: "PETITION_SUBMITTED",
    petitionId: newPetition.id,
    details: `New petition submitted: ${petitionData.subject}`,
  })

  return newPetition
}

export function getPetitions(): Petition[] {
  return petitions
}

export function getPetitionsByStudent(studentId: string): Petition[] {
  return petitions.filter((p) => p.studentId === studentId)
}

export function getPetitionById(id: string): Petition | undefined {
  return petitions.find((p) => p.id === id)
}

export function getPetitionsByRole(userRole: string, userEmail: string, department?: string): Petition[] {
  switch (userRole) {
    case "class_advisor":
      return petitions.filter((p) => p.department === department && p.escalationLevel === 1)
    case "hod":
      return petitions.filter((p) => p.department === department && p.escalationLevel >= 2)
    case "registrar":
      return petitions.filter((p) => p.escalationLevel >= 3)
    default:
      return []
  }
}

export function updatePetitionStatus(petitionId: string, newStatus: PetitionStatus, assignedTo?: string): boolean {
  const petition = petitions.find((p) => p.id === petitionId)
  if (!petition) return false

  const oldStatus = petition.status
  petition.status = newStatus
  petition.updatedAt = new Date()

  if (assignedTo) {
    petition.assignedTo = assignedTo
  }

  // Update escalation level based on status
  if (newStatus === "forwarded_to_hod") {
    petition.escalationLevel = 2
  } else if (newStatus === "forwarded_to_registrar") {
    petition.escalationLevel = 3
  }

  if (oldStatus !== newStatus) {
    createStatusUpdateNotification(petitionId, petition.studentId, newStatus, petition.subject)

    addAuditLog({
      userId: assignedTo || "system",
      userRole: "admin",
      action: "STATUS_UPDATE",
      petitionId,
      details: `Changed petition status from '${oldStatus}' to '${newStatus}'`,
    })
  }

  return true
}

export function addPetitionComment(petitionId: string, comment: Omit<PetitionComment, "id" | "createdAt">): boolean {
  const petition = petitions.find((p) => p.id === petitionId)
  if (!petition) return false

  if (!petition.comments) {
    petition.comments = []
  }

  const newComment: PetitionComment = {
    ...comment,
    id: `COMMENT-${Date.now()}`,
    createdAt: new Date(),
  }

  petition.comments.push(newComment)
  petition.updatedAt = new Date()
  return true
}
