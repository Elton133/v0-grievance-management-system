import type { Ticket } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, ArrowRight, XCircle, User } from "lucide-react"

interface TicketTimelineProps {
  ticket: Ticket
}

const timelineSteps = [
  { status: "submitted", label: "Ticket Submitted", icon: CheckCircle, color: "text-green-600" },
  { status: "under_review", label: "Under Review", icon: Clock, color: "text-yellow-600" },
  { status: "forwarded_to_hod", label: "Forwarded to HOD", icon: ArrowRight, color: "text-purple-600" },
  { status: "forwarded_to_registrar", label: "Forwarded to Registrar", icon: ArrowRight, color: "text-orange-600" },
  { status: "resolved", label: "Resolved", icon: CheckCircle, color: "text-green-600" },
  { status: "rejected", label: "Rejected", icon: XCircle, color: "text-red-600" },
]

export function TicketTimeline({ ticket }: TicketTimelineProps) {
  const getCurrentStepIndex = () => {
    return timelineSteps.findIndex((step) => step.status === ticket.status)
  }

  const currentStepIndex = getCurrentStepIndex()

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) return "completed"
    if (stepIndex === currentStepIndex) return "current"
    return "upcoming"
  }

  // Filter out rejected/resolved steps if not applicable
  const relevantSteps = timelineSteps.filter((step) => {
    if (step.status === "rejected" && ticket.status !== "rejected") return false
    if (step.status === "resolved" && ticket.status !== "resolved") return false
    return true
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Status Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {relevantSteps.map((step, index) => {
            const stepStatus = getStepStatus(index)
            const StepIcon = step.icon

            return (
              <div key={step.status} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`rounded-full p-2 ${
                      stepStatus === "completed"
                        ? "bg-green-100"
                        : stepStatus === "current"
                          ? "bg-primary/10"
                          : "bg-gray-100"
                    }`}
                  >
                    <StepIcon
                      className={`h-4 w-4 ${
                        stepStatus === "completed"
                          ? "text-green-600"
                          : stepStatus === "current"
                            ? step.color
                            : "text-gray-400"
                      }`}
                    />
                  </div>
                  {index < relevantSteps.length - 1 && (
                    <div className={`w-px h-8 mt-2 ${stepStatus === "completed" ? "bg-green-200" : "bg-gray-200"}`} />
                  )}
                </div>

                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={`font-medium ${
                        stepStatus === "completed" || stepStatus === "current"
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    {stepStatus === "current" && (
                      <Badge variant="outline" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>

                  {stepStatus === "completed" && step.status === "submitted" && (
                    <p className="text-sm text-muted-foreground">
                      {ticket.submittedAt.toLocaleDateString()} at{" "}
                      {ticket.submittedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}

                  {stepStatus === "current" && (
                    <p className="text-sm text-muted-foreground">
                      Last updated: {ticket.updatedAt.toLocaleDateString()} at{" "}
                      {ticket.updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}

                  {ticket.assignedTo && stepStatus === "current" && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Assigned to: {ticket.assignedTo}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {ticket.comments && ticket.comments.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-medium mb-3">Recent Updates</h4>
            <div className="space-y-3">
              {ticket.comments.slice(-3).map((comment) => (
                <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{comment.authorName}</p>
                    <p className="text-xs text-muted-foreground">{comment.createdAt.toLocaleDateString()}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{comment.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
