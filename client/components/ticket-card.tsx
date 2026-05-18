import type { Ticket } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Eye, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react"
import Link from "next/link"
import { useSettings } from "@/lib/settings-context"
import { formatTicketRef } from "@/lib/ticket-ref"
import { petitionSubjectLabel, petitionTypeLabel } from "@/lib/petition-form-options"

interface TicketCardProps {
  ticket: Ticket
}

const defaultStatusConfig = {
  submitted: {
    color: "#3b82f6",
    icon: Clock,
    label: "Submitted",
  },
  under_review: {
    color: "#f59e0b",
    icon: AlertCircle,
    label: "Under Review",
  },
  forwarded_to_hod: {
    color: "#8b5cf6",
    icon: AlertCircle,
    label: "Forwarded to HOD",
  },
  forwarded_to_registrar: {
    color: "#6366f1",
    icon: AlertCircle,
    label: "Forwarded to Registrar",
  },
  resolved: {
    color: "#22c55e",
    icon: CheckCircle,
    label: "Resolved",
  },
  rejected: {
    color: "#ef4444",
    icon: XCircle,
    label: "Rejected",
  },
} as const

export function TicketCard({ ticket }: TicketCardProps) {
  const { settings, getStatusLabel, getStatusColor } = useSettings()
  const ticketRef = formatTicketRef(ticket)

  // Resolve status label and color from tenant settings, with sensible defaults
  const labelFromSettings = getStatusLabel(ticket.status)
  const colorFromSettings = getStatusColor(ticket.status)

  const fallback = (defaultStatusConfig as any)[ticket.status] ?? {
    color: "#6b7280",
    icon: AlertCircle,
    label: labelFromSettings || ticket.status.replace(/_/g, " "),
  }

  const StatusIcon = fallback.icon
  const badgeBg = `${colorFromSettings || fallback.color}20`
  const badgeBorder = colorFromSettings || fallback.color
  const badgeText = colorFromSettings || fallback.color

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-semibold text-foreground line-clamp-2 sm:line-clamp-1 break-words">
              {petitionSubjectLabel(ticket.subject)}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">{ticketRef}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge
              className="text-xs"
              variant="outline"
              style={{
                backgroundColor: badgeBg,
                borderColor: badgeBorder,
                color: badgeText,
              }}
            >
              <StatusIcon className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">{labelFromSettings || fallback.label}</span>
              <span className="sm:hidden">
                {(labelFromSettings || fallback.label).split(" ")[0]}
              </span>
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {ticket.year}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{ticket.description}</p>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="whitespace-nowrap">{ticket.submittedAt.toLocaleDateString()}</span>
            </div>
            <div>{petitionTypeLabel(ticket.type)}</div>
          </div>

          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link href={`/ticket/${ticket.id}`}>
              <Eye className="mr-1 h-3 w-3" />
              View
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
