import type { Petition } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Eye, AlertCircle, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"

interface PetitionCardProps {
  petition: Petition
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
    icon: AlertCircle,
    label: "Forwarded to HOD",
  },
  forwarded_to_registrar: {
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: AlertCircle,
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

export function PetitionCard({ petition }: PetitionCardProps) {
  const statusInfo = statusConfig[petition.status]
  const StatusIcon = statusInfo.icon

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground line-clamp-1">{petition.subject}</h3>
            <p className="text-sm text-muted-foreground">#{petition.id}</p>
          </div>
          <div className="flex gap-2">
            <Badge className={statusInfo.color} variant="outline">
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusInfo.label}
            </Badge>
            <Badge className={priorityConfig[petition.priority]} variant="outline">
              {petition.priority.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{petition.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {petition.submittedAt.toLocaleDateString()}
            </div>
            <div className="capitalize">{petition.type.replace(/_/g, " ")}</div>
          </div>

          <Button asChild size="sm" variant="outline">
            <Link href={`/petition/${petition.id}`}>
              <Eye className="mr-1 h-3 w-3" />
              View
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
