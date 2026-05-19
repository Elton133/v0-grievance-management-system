"use client"

import type { Ticket, TicketStatus, TicketComment, PetitionAttachment } from "./types"
import type { RoleConfig } from "./settings-context"
import { ticketApi } from "./api"
import { departmentsEquivalentForRoster } from "./departmentRosterMatch"

function normGroup(s?: string | null) {
  return s?.trim().toLowerCase() ?? ""
}

function resolveAssigneeUserId(backendTicket: {
  assignedTo?: string | null
  assignedUser?: { id?: string } | null
}): string | undefined {
  if (backendTicket.assignedUser?.id) return backendTicket.assignedUser.id
  const raw = backendTicket.assignedTo
  if (typeof raw !== "string" || !raw.trim()) return undefined
  // Prisma cuid/uuid-style ids (avoid treating emails as ids)
  if (/^[0-9a-z]{20,}$/i.test(raw.trim()) || /^[0-9a-f-]{36}$/i.test(raw.trim())) return raw.trim()
  return undefined
}

/** Whether the ticket is assigned to this account (by id or email). */
export function isTicketAssignedToUser(
  ticket: Ticket,
  user: { id: string; email: string }
): boolean {
  if (ticket.assignedToUserId && ticket.assignedToUserId === user.id) return true
  const e = user.email?.trim().toLowerCase()
  const a = ticket.assignedTo?.trim().toLowerCase()
  return Boolean(e && a && e === a)
}

/** Union by id: role queue plus anything explicitly assigned to this reviewer (handles el mismatch / manual assigns). */
function mergeQueueWithDirectAssignments(
  queue: Ticket[],
  allTickets: Ticket[],
  userId: string | undefined,
  userEmail: string
): Ticket[] {
  if (!userId) return queue
  const assigned = allTickets.filter((t) =>
    isTicketAssignedToUser(t, { id: userId, email: userEmail })
  )
  if (assigned.length === 0) return queue
  const byId = new Map<string, Ticket>()
  for (const t of queue) byId.set(t.id, t)
  for (const t of assigned) byId.set(t.id, t)
  return Array.from(byId.values())
}

// Re-export types for convenience
export type { Ticket, TicketStatus, TicketComment }

// Transform backend ticket to frontend Ticket type
function transformTicket(backendTicket: any): Ticket {
  // Keep internal FK (UUID) for ownership checks.
  const submitterId = backendTicket.submitterId || backendTicket.submitter?.id
  // Human-facing student index number for UI display.
  const submitterIndexNumber = backendTicket.submitter?.submitterId || backendTicket.submitterIndexNumber
  const submitterName = backendTicket.submitterName || backendTicket.submitter?.name
  const submitterEmail = backendTicket.submitterEmail || backendTicket.submitter?.email

  return {
    id: backendTicket.id,
    referenceCode: backendTicket.referenceCode ?? undefined,
    submitterId: submitterId,
    submitterIndexNumber,
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
    assignedToUserId: resolveAssigneeUserId(backendTicket),
    assignedUserName: backendTicket.assignedUser?.name,
    comments: backendTicket.comments?.map((c: any) => ({
      id: c.id,
      ticketId: backendTicket.id,
      authorId: c.authorId,
      authorName: c.authorName || c.author?.name,
      authorRole: c.authorRole || c.author?.role,
      content: c.content,
      isInternal: c.isInternal,
      createdAt: new Date(c.createdAt),
    })) || [],
    statusHistory:
      backendTicket.statusHistory?.map((h: any) => ({
        id: h.id,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        changedByName: h.changedByName,
        changedByRole: h.changedByRole,
        comment: h.comment,
        changedAt: new Date(h.changedAt),
      })) || [],
    attachments:
      backendTicket.attachments?.map(
        (a: {
          id: string
          fileName: string
          fileUrl: string
          fileSize?: number | null
          mimeType?: string | null
          uploadedAt: string
        }): PetitionAttachment => ({
          id: a.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileSize: a.fileSize ?? undefined,
          mimeType: a.mimeType ?? undefined,
          uploadedAt: new Date(a.uploadedAt),
        })
      ) ?? [],
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
      priority: ticketData.priority ?? "medium",
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

/** Statuses each reviewer role should see in their department queue. */
const REGISTRAR_QUEUE: TicketStatus[] = ["forwarded_to_registrar", "forwarded_to_hod"]

const STATUS_QUEUE_BY_ROLE: Record<string, TicketStatus[]> = {
  advisor: ["submitted", "under_review"],
  class_advisor: ["submitted", "under_review"],
  hod: REGISTRAR_QUEUE,
  registrar: REGISTRAR_QUEUE,
}

function departmentMatches(
  ticketGroup: string | undefined,
  userGroup: string | undefined,
  groupScoped: boolean
): boolean {
  if (!groupScoped) return true
  if (!userGroup?.trim()) return !ticketGroup?.trim()
  if (departmentsEquivalentForRoster(ticketGroup, userGroup)) return true
  return normGroup(ticketGroup) === normGroup(userGroup)
}

function ticketInRoleQueue(
  ticket: Ticket,
  userRole: string,
  userGroup: string | undefined,
  groupScoped: boolean
): boolean {
  const statuses = STATUS_QUEUE_BY_ROLE[userRole]
  if (!statuses?.includes(ticket.status)) return false
  return departmentMatches(ticket.group, userGroup, groupScoped)
}

/**
 * Reviewer queue by workflow status + department (ICT/IT equivalents).
 * Also merges anything explicitly assigned to this user (id or email).
 */
export async function getTicketsByRole(
  userRole: string,
  userEmail: string,
  group?: string,
  rolesConfig?: RoleConfig[],
  userId?: string
): Promise<Ticket[]> {
  try {
    const response = await getTickets(1, 1000)
    const allTickets = response.data

    const reviewers = (rolesConfig ?? [])
      .filter((r) => !r.isSubmitter && Number(r.level) > 0)
      .sort((a, b) => Number(a.level) - Number(b.level))

    const roleConfig = reviewers.find((r) => r.key === userRole)
    const groupScoped =
      userRole === "registrar"
        ? roleConfig?.groupScoped === true
        : roleConfig?.groupScoped !== false

    let queue: Ticket[] = []

    if (STATUS_QUEUE_BY_ROLE[userRole]) {
      queue = allTickets.filter((p) => ticketInRoleQueue(p, userRole, group, groupScoped))
    } else if (userId) {
      queue = allTickets.filter((t) =>
        isTicketAssignedToUser(t, { id: userId, email: userEmail })
      )
    }

    return mergeQueueWithDirectAssignments(queue, allTickets, userId, userEmail)
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
