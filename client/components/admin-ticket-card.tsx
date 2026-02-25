"use client"

import type { Ticket } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Eye, User, GraduationCap, AlertCircle, CheckCircle, Clock, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"

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

export function AdminTicketCard({ ticket, userRole, onStatusUpdate, isUpdating = false }: AdminTicketCardProps) {
  const statusInfo = statusConfig[ticket.status]
  const StatusIcon = statusInfo.icon

  const getAvailableActions = () => {
    const actions = []

    if (userRole === "class_advisor" && ticket.status === "submitted") {
      actions.push({ label: "Start Review", status: "under_review" })
      actions.push({ label: "Forward to HOD", status: "forwarded_to_hod" })
    }

    if (userRole === "class_advisor" && ticket.status === "under_review") {
      actions.push({ label: "Resolve", status: "resolved" })
      actions.push({ label: "Forward to HOD", status: "forwarded_to_hod" })
      actions.push({ label: "Reject", status: "rejected" })
    }

    if (userRole === "hod" && ["forwarded_to_hod", "under_review"].includes(ticket.status)) {
      actions.push({ label: "Resolve", status: "resolved" })
      actions.push({ label: "Forward to Registrar", status: "forwarded_to_registrar" })
      actions.push({ label: "Reject", status: "rejected" })
    }

    if (userRole === "registrar" && ticket.status === "forwarded_to_registrar") {
      actions.push({ label: "Resolve", status: "resolved" })
      actions.push({ label: "Reject", status: "rejected" })
    }

    return actions
  }

  const availableActions = getAvailableActions()

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground line-clamp-1">{ticket.subject}</h3>
            <p className="text-sm text-muted-foreground">#{ticket.id}</p>
          </div>
          <div className="flex gap-2">
            <Badge className={statusInfo.color} variant="outline">
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusInfo.label}
            </Badge>
            <Badge className={priorityConfig[ticket.priority]} variant="outline">
              {ticket.priority.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>

        {/* Submitter Information */}
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
