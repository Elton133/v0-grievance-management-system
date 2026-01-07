"use client"

import type { Petition, PetitionStatus, PetitionComment } from "./types"
import { petitionApi } from "./api"

// Re-export types for convenience
export type { Petition, PetitionStatus, PetitionComment }

// Transform backend petition to frontend Petition type
function transformPetition(backendPetition: any): Petition {
  // Backend returns studentId as the User ID (UUID), not the student ID string
  // Also handle nested student object if present
  const studentId = backendPetition.studentId || backendPetition.student?.id
  const studentName = backendPetition.studentName || backendPetition.student?.name
  const studentEmail = backendPetition.studentEmail || backendPetition.student?.email
  
  return {
    id: backendPetition.id,
    studentId: studentId, // This is the User ID (UUID), not the student ID string
    studentName: studentName,
    studentEmail: studentEmail,
    department: backendPetition.department,
    year: backendPetition.year,
    type: backendPetition.type,
    priority: backendPetition.priority,
    subject: backendPetition.subject,
    description: backendPetition.description,
    status: backendPetition.status,
    submittedAt: new Date(backendPetition.submittedAt),
    updatedAt: new Date(backendPetition.updatedAt),
    escalationLevel: backendPetition.escalationLevel || 1,
    assignedTo: backendPetition.assignedUser?.email || backendPetition.assignedTo,
    comments: backendPetition.comments?.map((c: any) => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.authorName || c.author?.name,
      authorRole: c.authorRole || c.author?.role,
      content: c.content,
      isInternal: c.isInternal,
      createdAt: new Date(c.createdAt),
    })) || [],
  }
}

export async function submitPetition(
  petitionData: Omit<Petition, "id" | "submittedAt" | "updatedAt" | "status" | "escalationLevel" | "comments">
): Promise<Petition> {
  try {
    const response = await petitionApi.create({
      subject: petitionData.subject,
      description: petitionData.description,
      type: petitionData.type,
      department: petitionData.department,
      year: petitionData.year,
      priority: petitionData.priority,
    })
    return transformPetition(response)
  } catch (error) {
    console.error("Error submitting petition:", error)
    throw error
  }
}

export async function getPetitions(): Promise<Petition[]> {
  try {
    const response = await petitionApi.getAll()
    return response.map(transformPetition)
  } catch (error) {
    console.error("Error fetching petitions:", error)
    return []
  }
}

export async function getPetitionsByStudent(studentId: string): Promise<Petition[]> {
  try {
    const response = await petitionApi.getMyPetitions()
    return response.map(transformPetition)
  } catch (error) {
    console.error("Error fetching student petitions:", error)
    return []
  }
}

export async function getPetitionById(id: string): Promise<Petition | null> {
  try {
    const response = await petitionApi.getById(id)
    return transformPetition(response)
  } catch (error) {
    console.error("Error fetching petition:", error)
    return null
  }
}

export async function getPetitionsByRole(
  userRole: string,
  userEmail: string,
  department?: string
): Promise<Petition[]> {
  try {
    const allPetitions = await getPetitions()
    
    switch (userRole) {
      case "class_advisor":
        return allPetitions.filter(
          (p) => p.department === department && p.escalationLevel === 1
        )
      case "hod":
        return allPetitions.filter(
          (p) => p.department === department && p.escalationLevel >= 2
        )
      case "registrar":
        return allPetitions.filter((p) => p.escalationLevel >= 3)
      default:
        return []
    }
  } catch (error) {
    console.error("Error fetching petitions by role:", error)
    return []
  }
}

export async function updatePetitionStatus(
  petitionId: string,
  newStatus: PetitionStatus,
  comment?: string
): Promise<boolean> {
  try {
    await petitionApi.updateStatus(petitionId, newStatus, comment)
    return true
  } catch (error) {
    console.error("Error updating petition status:", error)
    return false
  }
}

export async function addPetitionComment(
  petitionId: string,
  content: string,
  isInternal: boolean = false
): Promise<PetitionComment | null> {
  try {
    const response = await petitionApi.addComment(petitionId, content, isInternal)
    return {
      id: response.id,
      authorId: response.authorId,
      authorName: response.authorName,
      authorRole: response.authorRole,
      content: response.content,
      isInternal: response.isInternal,
      createdAt: new Date(response.createdAt),
    }
  } catch (error) {
    console.error("Error adding comment:", error)
    return null
  }
}

export async function updatePetitionDetails(
  petitionId: string,
  data: {
    subject?: string
    description?: string
    type?: string
    priority?: string
    year?: string
    department?: string
  }
): Promise<Petition | null> {
  try {
    const response = await petitionApi.update(petitionId, data)
    return transformPetition(response)
  } catch (error) {
    console.error("Error updating petition:", error)
    throw error
  }
}

export async function deletePetitionById(petitionId: string): Promise<boolean> {
  try {
    await petitionApi.delete(petitionId)
    return true
  } catch (error) {
    console.error("Error deleting petition:", error)
    return false
  }
}
