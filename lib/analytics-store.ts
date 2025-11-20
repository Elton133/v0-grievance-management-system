"use client"

import { getPetitions } from "./petition-store"
import type { PetitionStatus, PetitionType } from "./types"

export interface AnalyticsData {
  totalPetitions: number
  petitionsByStatus: Record<PetitionStatus, number>
  petitionsByType: Record<PetitionType, number>
  petitionsByPriority: Record<string, number>
  petitionsByDepartment: Record<string, number>
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
  petitionId?: string
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
    petitionId: "PET-2024-001",
    details: "Changed petition status from 'submitted' to 'under_review'",
  },
  {
    id: "AUDIT-002",
    timestamp: new Date("2024-01-15T14:20:00"),
    userId: "ST2024001",
    userRole: "student",
    action: "PETITION_SUBMITTED",
    petitionId: "PET-2024-001",
    details: "New petition submitted: Grade Discrepancy in Data Structures Course",
  },
  {
    id: "AUDIT-003",
    timestamp: new Date("2024-01-12T16:45:00"),
    userId: "advisor@university.edu",
    userRole: "class_advisor",
    action: "PETITION_FORWARDED",
    petitionId: "PET-2024-002",
    details: "Petition forwarded to HOD for escalation",
  },
]

export function getAnalyticsData(): AnalyticsData {
  const petitions = getPetitions()

  // Calculate basic metrics
  const totalPetitions = petitions.length

  const petitionsByStatus = petitions.reduce(
    (acc, petition) => {
      acc[petition.status] = (acc[petition.status] || 0) + 1
      return acc
    },
    {} as Record<PetitionStatus, number>,
  )

  const petitionsByType = petitions.reduce(
    (acc, petition) => {
      acc[petition.type] = (acc[petition.type] || 0) + 1
      return acc
    },
    {} as Record<PetitionType, number>,
  )

  const petitionsByPriority = petitions.reduce(
    (acc, petition) => {
      acc[petition.priority] = (acc[petition.priority] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const petitionsByDepartment = petitions.reduce(
    (acc, petition) => {
      acc[petition.department] = (acc[petition.department] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  // Calculate resolution time (mock data for now)
  const resolvedPetitions = petitions.filter((p) => p.status === "resolved")
  const averageResolutionTime =
    resolvedPetitions.length > 0
      ? resolvedPetitions.reduce((acc, petition) => {
          const resolutionTime = petition.updatedAt.getTime() - petition.submittedAt.getTime()
          return acc + resolutionTime / (1000 * 60 * 60 * 24) // Convert to days
        }, 0) / resolvedPetitions.length
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
    escalationRate: 0.25, // 25% of petitions get escalated
  }

  return {
    totalPetitions,
    petitionsByStatus,
    petitionsByType,
    petitionsByPriority,
    petitionsByDepartment,
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

export function getAuditLogsByPetition(petitionId: string): AuditLog[] {
  return auditLogs
    .filter((log) => log.petitionId === petitionId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

export function getAuditLogsByUser(userId: string): AuditLog[] {
  return auditLogs.filter((log) => log.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}
