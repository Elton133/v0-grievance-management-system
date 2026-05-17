"use client"

import { useMemo } from "react"
import type { Ticket } from "@/lib/types"
import { useSettings } from "@/lib/settings-context"
import type { RoleConfig } from "@/lib/settings-context"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Eye, User, GraduationCap, AlertCircle, CheckCircle, Clock, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { formatTicketRef } from "@/lib/ticket-ref"

interface AdminTicketCardProps {
  ticket: Ticket
  userRole: string
  onStatusUpdate?: (ticketId: string, newStatus: string) => void
  isUpdating?: boolean
}

const statusConfig = {
  submitted: {
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Clock,
    label: "Submitted",
  },
  under_review: {
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: AlertCircle,
    label: "Under Review",
  },
  forwarded_to_hod: {
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: ArrowRight,
    label: "Forwarded to HOD",
  },
  forwarded_to_registrar: {
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: ArrowRight,
    label: "Forwarded to Registrar",
  },
  resolved: {
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle,
    label: "Resolved",
  },
  rejected: {
    color: "bg-red-100 text-red-800 border-red-200",
    icon: AlertCircle,
    label: "Rejected",
  },
}

const priorityConfig = {
  low: "bg-gray-100 text-gray-800 border-gray-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  urgent: "bg-red-100 text-red-800 border-red-200",
}

/** Map current user role to workflow action sets using tenant reviewer order (same idea as ticket queue). */
function getReviewerActionFlags(userRole: string, rolesConfig: RoleConfig[] | undefined) {
  const reviewers = (rolesConfig ?? [])
    .filter((r) => !r.isSubmitter && Number(r.level) > 0)
    .sort((a, b) => Number(a.level) - Number(b.level))

  const idx = reviewers.findIndex((r) => r.key === userRole)
  const last = reviewers.length - 1

  if (idx < 0 || reviewers.length === 0) {
    return {
      isFirstReviewer: userRole === "class_advisor" || userRole === "advisor",
      canActAsHod: userRole === "hod",
      canActAsRegistrar: userRole === "registrar",
    }
  }

  const isFirst = idx === 0
  const isLast = idx === last
  const twoTier = reviewers.length === 2
  const middle = idx > 0 && idx < last

  return {
    isFirstReviewer: isFirst,
    canActAsHod: middle || (twoTier && isLast && idx > 0),
    // Last reviewer in the configured chain is the final approver (registrar-equivalent).
    canActAsRegistrar: isLast,
  }
}

export function AdminTicketCard({ ticket, userRole, onStatusUpdate, isUpdating = false }: AdminTicketCardProps) {
  const { settings } = useSettings()
  const ticketRef = formatTicketRef(ticket)

  const flags = useMemo(
    () => getReviewerActionFlags(userRole, settings.rolesConfig),
    [userRole, settings.rolesConfig]
  )

  const statusKey = ticket.status as keyof typeof statusConfig
  const statusInfo =
    statusConfig[statusKey] ??
    ({
      color: "bg-muted text-foreground border-border",
      icon: Clock,
      label: ticket.status.replace(/_/g, " "),
    } as (typeof statusConfig)["submitted"])
  const StatusIcon = statusInfo.icon

  const availableActions = useMemo(() => {
    const actions: { label: string; status: string }[] = []
    const { isFirstReviewer, canActAsHod, canActAsRegistrar } = flags

    if (isFirstReviewer && ticket.status === "submitted") {
      actions.push({ label: "Start Review", status: "under_review" })
      actions.push({ label: "Forward to HOD", status: "forwarded_to_hod" })
    }

    if (isFirstReviewer && ticket.status === "under_review") {
      actions.push({ label: "Resolve", status: "resolved" })
      actions.push({ label: "Forward to HOD", status: "forwarded_to_hod" })
      actions.push({ label: "Reject", status: "rejected" })
    }

    if (canActAsHod && ["forwarded_to_hod", "under_review"].includes(ticket.status)) {
      actions.push({ label: "Resolve", status: "resolved" })
      actions.push({ label: "Forward to Registrar", status: "forwarded_to_registrar" })
      actions.push({ label: "Reject", status: "rejected" })
    }

    // Registrar/final approver: allow terminal actions when ticket is at final escalation slot.
    const atRegistrarStage =
      ticket.status === "forwarded_to_registrar" ||
      (ticket.escalationLevel >= 3 && !["resolved", "rejected"].includes(ticket.status))

    if (canActAsRegistrar && atRegistrarStage) {
      actions.push({ label: "Resolve", status: "resolved" })
      actions.push({ label: "Reject", status: "rejected" })
    }

    return actions
  }, [ticket.status, flags])

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <h3 className="font-semibold text-foreground line-clamp-1">{ticket.subject}</h3>
            <p className="text-sm text-muted-foreground">{ticketRef}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end max-w-[65%]">
            <Badge className={`${statusInfo.color} max-w-full`} variant="outline">
              <StatusIcon className="mr-1 h-3 w-3" />
              <span className="truncate">{statusInfo.label}</span>
            </Badge>
            <Badge className={priorityConfig[ticket.priority]} variant="outline">
              {ticket.priority.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>

        {/* Student summary */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {ticket.submitterName}
          </div>
          <div className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {ticket.year}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {ticket.submittedAt.toLocaleDateString()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {availableActions.slice(0, 2).map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant={action.status === "resolved" ? "default" : "outline"}
                onClick={() => onStatusUpdate?.(ticket.id, action.status)}
                className="text-xs"
                disabled={isUpdating}
              >
                {action.label}
              </Button>
            ))}
          </div>

          <Button asChild size="sm" variant="ghost">
            <Link href={`/ticket/${ticket.id}`}>
              <Eye className="mr-1 h-3 w-3" />
              View Details
            </Link>
          </Button>
        </div>

        {availableActions.length > 2 && (
          <div className="flex gap-1 pt-2 border-t">
            {availableActions.slice(2).map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant="outline"
                onClick={() => onStatusUpdate?.(ticket.id, action.status)}
                className="text-xs flex-1"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Updating...
                  </>
                ) : (
                  action.label
                )}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
