"use client"

import { getTickets } from "./ticket-store"
import type { TicketStatus, TicketType } from "./types"

export interface AnalyticsData {
  totalTickets: number
  ticketsByStatus: Record<TicketStatus, number>
  ticketsByType: Record<TicketType, number>
  ticketsByPriority: Record<string, number>
  ticketsByGroup: Record<string, number>
  averageResolutionTime: number
  monthlyTrends: Array<{ month: string; count: number; resolved: number }>
  responseTimeMetrics: {
    averageResponseTime: number
    medianResponseTime: number
    escalationRate: number
  }
}

export interface AuditLog {
  id: string
  timestamp: Date
  userId: string
  userRole: string
  action: string
  ticketId?: string
  details: string
  ipAddress?: string
}

// Mock audit logs
const auditLogs: AuditLog[] = [
  {
    id: "AUDIT-001",
    timestamp: new Date("2024-01-16T10:30:00"),
    userId: "advisor@university.edu",
    userRole: "class_advisor",
    action: "STATUS_UPDATE",
    ticketId: "PET-2024-001",
    details: "Changed ticket status from 'submitted' to 'under_review'",
  },
  {
    id: "AUDIT-002",
    timestamp: new Date("2024-01-15T14:20:00"),
    userId: "ST2024001",
    userRole: "submitter",
    action: "TICKET_SUBMITTED",
    ticketId: "PET-2024-001",
    details: "New ticket submitted: Grade Discrepancy in Data Structures Course",
  },
  {
    id: "AUDIT-003",
    timestamp: new Date("2024-01-12T16:45:00"),
    userId: "advisor@university.edu",
    userRole: "class_advisor",
    action: "TICKET_FORWARDED",
    ticketId: "PET-2024-002",
    details: "Ticket forwarded to HOD for escalation",
  },
]

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const tickets = await getTickets()

  // Calculate basic metrics
  const totalTickets = tickets.length

  const ticketsByStatus = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1
      return acc
    },
    {} as Record<TicketStatus, number>,
  )

  const ticketsByType = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.type] = (acc[ticket.type] || 0) + 1
      return acc
    },
    {} as Record<TicketType, number>,
  )

  const ticketsByPriority = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.priority] = (acc[ticket.priority] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const ticketsByGroup = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.group] = (acc[ticket.group] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  // Calculate resolution time (mock data for now)
  const resolvedTickets = tickets.filter((p) => p.status === "resolved")
  const averageResolutionTime =
    resolvedTickets.length > 0
      ? resolvedTickets.reduce((acc, ticket) => {
          const resolutionTime = ticket.updatedAt.getTime() - ticket.submittedAt.getTime()
          return acc + resolutionTime / (1000 * 60 * 60 * 24) // Convert to days
        }, 0) / resolvedTickets.length
      : 0

  // Generate monthly trends (mock data)
  const monthlyTrends = [
    { month: "Dec 2023", count: 8, resolved: 6 },
    { month: "Jan 2024", count: 12, resolved: 9 },
    { month: "Feb 2024", count: 15, resolved: 11 },
    { month: "Mar 2024", count: 10, resolved: 8 },
  ]

  // Response time metrics
  const responseTimeMetrics = {
    averageResponseTime: 2.5, // days
    medianResponseTime: 2.0, // days
    escalationRate: 0.25, // 25% of tickets get escalated
  }

  return {
    totalTickets,
    ticketsByStatus,
    ticketsByType,
    ticketsByPriority,
    ticketsByGroup,
    averageResolutionTime,
    monthlyTrends,
    responseTimeMetrics,
  }
}

export function getAuditLogs(limit?: number): AuditLog[] {
  const sortedLogs = auditLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  return limit ? sortedLogs.slice(0, limit) : sortedLogs
}

export function addAuditLog(log: Omit<AuditLog, "id" | "timestamp">): void {
  const newLog: AuditLog = {
    ...log,
    id: `AUDIT-${Date.now()}`,
    timestamp: new Date(),
  }
  auditLogs.push(newLog)
}

export function getAuditLogsByTicket(ticketId: string): AuditLog[] {
  return auditLogs
    .filter((log) => log.ticketId === ticketId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

export function getAuditLogsByUser(userId: string): AuditLog[] {
  return auditLogs.filter((log) => log.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}
