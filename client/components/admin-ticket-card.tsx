"use client"

import type { Ticket } from "@/lib/types"
import { useSettings } from "@/lib/settings-context"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Eye, User, GraduationCap, Clock } from "lucide-react"
import Link from "next/link"
import { formatTicketRef } from "@/lib/ticket-ref"
import { petitionSubjectLabel, petitionTypeLabel } from "@/lib/petition-form-options"
import { canUserActOnPetition } from "@/lib/reviewer-actions"

interface AdminTicketCardProps {
  ticket: Ticket
  userRole: string
}

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  under_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
  forwarded_to_hod: "bg-purple-100 text-purple-800 border-purple-200",
  forwarded_to_registrar: "bg-orange-100 text-orange-800 border-orange-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
}

export function AdminTicketCard({ ticket, userRole }: AdminTicketCardProps) {
  const { getStatusLabel, settings } = useSettings()
  const needsDecision = canUserActOnPetition(ticket, userRole, settings.rolesConfig)
  const ref = formatTicketRef(ticket)
  const statusClass = statusColors[ticket.status] ?? "bg-muted text-foreground border-border"

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold line-clamp-1">{petitionSubjectLabel(ticket.subject)}</h3>
            <p className="text-sm text-muted-foreground">{ref}</p>
          </div>
          <motion.div className="flex flex-col items-end gap-1">
            <Badge className={statusClass} variant="outline">
              <Clock className="mr-1 h-3 w-3" />
              {getStatusLabel(ticket.status)}
            </Badge>
            {needsDecision && (
              <Badge className="bg-primary text-primary-foreground">Decision needed</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {ticket.submitterName}
          </span>
          <span className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {ticket.year}
          </span>
          <span>{petitionTypeLabel(ticket.type)}</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {ticket.submittedAt.toLocaleDateString()}
          </span>
        </div>
        <Button asChild size="sm" className="w-full">
          <Link href={`/ticket/${ticket.id}`}>
            <Eye className="mr-1 h-3 w-3" />
            Review petition
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

