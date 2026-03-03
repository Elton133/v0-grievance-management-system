"use client"

import type { Ticket, TicketStatus, TicketComment } from "./types"
import { ticketApi } from "./api"

// Re-export types for convenience
export type { Ticket, TicketStatus, TicketComment }

// Transform backend ticket to frontend Ticket type
function transformTicket(backendTicket: any): Ticket {
  // Backend returns submitterId as the User ID (UUID), not the submitter ID string
  // Also handle nested submitter object if present
  const submitterId = backendTicket.submitterId || backendTicket.submitter?.id
  const submitterName = backendTicket.submitterName || backendTicket.submitter?.name
  const submitterEmail = backendTicket.submitterEmail || backendTicket.submitter?.email

  return {
    id: backendTicket.id,
    submitterId: submitterId, // This is the User ID (UUID), not the submitter ID string
    submitterName: submitterName,
    submitterEmail: submitterEmail,
    group: backendTicket.group,
    year: backendTicket.year,
    type: backendTicket.type,
    priority: backendTicket.priority,
    subject: backendTicket.subject,
    description: backendTicket.description,
    status: backendTicket.status,
    submittedAt: new Date(backendTicket.submittedAt),
    updatedAt: new Date(backendTicket.updatedAt),
    firstResponseAt: backendTicket.firstResponseAt
      ? new Date(backendTicket.firstResponseAt)
      : undefined,
    resolvedAt: backendTicket.resolvedAt ? new Date(backendTicket.resolvedAt) : undefined,
    lastStatusChangedAt: backendTicket.lastStatusChangedAt
      ? new Date(backendTicket.lastStatusChangedAt)
      : undefined,
    escalationLevel: backendTicket.escalationLevel || 1,
    assignedTo: backendTicket.assignedUser?.email || backendTicket.assignedTo,
    comments: backendTicket.comments?.map((c: any) => ({
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

export async function submitTicket(
  ticketData: Omit<Ticket, "id" | "submittedAt" | "updatedAt" | "status" | "escalationLevel" | "comments">
): Promise<Ticket> {
  try {
    const response = await ticketApi.create({
      subject: ticketData.subject,
      description: ticketData.description,
      type: ticketData.type,
      group: ticketData.group,
      year: ticketData.year,
      priority: ticketData.priority,
    })
    return transformTicket(response)
  } catch (error) {
    console.error("Error submitting ticket:", error)
    throw error
  }
}

export async function getTickets(
  page: number = 1,
  limit: number = 20
): Promise<{ data: Ticket[]; pagination: any }> {
  try {
    const response = await ticketApi.getAll(page, limit)
    return {
      data: response.data.map(transformTicket),
      pagination: response.pagination,
    }
  } catch (error) {
    console.error("Error fetching tickets:", error)
    return { data: [], pagination: { page: 1, totalPages: 0, hasNext: false, hasPrev: false } }
  }
}

export async function getTicketsBySubmitter(
  submitterId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ data: Ticket[]; pagination: any }> {
  try {
    const response = await ticketApi.getMyTickets(page, limit)
    return {
      data: response.data.map(transformTicket),
      pagination: response.pagination,
    }
  } catch (error) {
    console.error("Error fetching submitter tickets:", error)
    return { data: [], pagination: { page: 1, totalPages: 0, hasNext: false, hasPrev: false } }
  }
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  try {
    const response = await ticketApi.getById(id)
    return transformTicket(response)
  } catch (error) {
    console.error("Error fetching ticket:", error)
    return null
  }
}

export async function getTicketsByRole(
  userRole: string,
  userEmail: string,
  group?: string
): Promise<Ticket[]> {
  try {
    const response = await getTickets(1, 1000)
    const allTickets = response.data

    switch (userRole) {
      case "class_advisor":
        return allTickets.filter(
          (p) => p.group === group && p.escalationLevel === 1
        )
      case "hod":
        return allTickets.filter(
          (p) => p.group === group && p.escalationLevel >= 2
        )
      case "registrar":
        return allTickets.filter((p) => p.escalationLevel >= 3)
      default:
        return []
    }
  } catch (error) {
    console.error("Error fetching tickets by role:", error)
    return []
  }
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
  comment?: string
): Promise<boolean> {
  try {
    await ticketApi.updateStatus(ticketId, newStatus, comment)
    return true
  } catch (error) {
    console.error("Error updating ticket status:", error)
    return false
  }
}

export async function addTicketComment(
  ticketId: string,
  content: string,
  isInternal: boolean = false
): Promise<TicketComment | null> {
  try {
    const response = await ticketApi.addComment(ticketId, content, isInternal)
    return {
      id: response.id,
      ticketId: ticketId,
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

export async function updateTicketDetails(
  ticketId: string,
  data: {
    subject?: string
    description?: string
    type?: string
    priority?: string
    year?: string
    group?: string
  }
): Promise<Ticket | null> {
  try {
    const response = await ticketApi.update(ticketId, data)
    return transformTicket(response)
  } catch (error) {
    console.error("Error updating ticket:", error)
    throw error
  }
}

export async function deleteTicketById(ticketId: string): Promise<boolean> {
  try {
    await ticketApi.delete(ticketId)
    return true
  } catch (error) {
    console.error("Error deleting ticket:", error)
    return false
  }
}
