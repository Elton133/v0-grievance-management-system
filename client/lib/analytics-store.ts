"use client"

import { getTickets } from "./ticket-store"
import { auditApi } from "./api"
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

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const result = await getTickets(1, 1000)
  const tickets = result.data

  const totalTickets = tickets.length

  const ticketsByStatus = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1
      return acc
    },
    {} as Record<TicketStatus, number>
  )

  const ticketsByType = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.type] = (acc[ticket.type] || 0) + 1
      return acc
    },
    {} as Record<TicketType, number>
  )

  const ticketsByPriority = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.priority] = (acc[ticket.priority] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const ticketsByGroup = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.group] = (acc[ticket.group] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const resolvedTickets = tickets.filter((p) => p.resolvedAt)
  const averageResolutionTime =
    resolvedTickets.length > 0
      ? resolvedTickets.reduce((acc, ticket) => {
          const end = ticket.resolvedAt ?? ticket.updatedAt
          const resolutionTime = end.getTime() - ticket.submittedAt.getTime()
          return acc + resolutionTime / (1000 * 60 * 60 * 24)
        }, 0) / resolvedTickets.length
      : 0

  const monthMap = new Map<string, { count: number; resolved: number }>()
  for (const t of tickets) {
    const d = t.submittedAt
    const key = `${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`
    const cur = monthMap.get(key) ?? { count: 0, resolved: 0 }
    cur.count += 1
    if (t.status === "resolved") cur.resolved += 1
    monthMap.set(key, cur)
  }
  const monthlyTrends = Array.from(monthMap.entries())
    .map(([month, v]) => ({ month, ...v }))
    .slice(-6)

  const withResponse = tickets.filter((t) => t.firstResponseAt)
  const responseDays = withResponse.map(
    (t) => (t.firstResponseAt!.getTime() - t.submittedAt.getTime()) / (1000 * 60 * 60 * 24)
  )
  responseDays.sort((a, b) => a - b)
  const averageResponseTime =
    responseDays.length > 0 ? responseDays.reduce((a, b) => a + b, 0) / responseDays.length : 0
  const medianResponseTime =
    responseDays.length > 0
      ? responseDays[Math.floor(responseDays.length / 2)]
      : 0
  const escalated = tickets.filter((t) => t.escalationLevel >= 2).length
  const escalationRate = totalTickets > 0 ? escalated / totalTickets : 0

  return {
    totalTickets,
    ticketsByStatus,
    ticketsByType,
    ticketsByPriority,
    ticketsByGroup,
    averageResolutionTime,
    monthlyTrends,
    responseTimeMetrics: {
      averageResponseTime,
      medianResponseTime,
      escalationRate,
    },
  }
}

/** Load audit entries from the database (written by recordAuditLog on the server). */
export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  try {
    const res = await auditApi.getLogs(1, limit)
    return res.data.map((row) => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      userId: row.userId,
      userRole: row.userRole,
      action: row.action,
      ticketId: row.ticketId,
      details: row.details,
      ipAddress: row.ipAddress,
    }))
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return []
  }
}
