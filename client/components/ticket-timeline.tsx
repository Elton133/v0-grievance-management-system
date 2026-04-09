import type { Ticket } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, XCircle, User } from "lucide-react"
import { useSettings } from "@/lib/settings-context"
import { useMemo } from "react"
import { buildActorTimelineSteps } from "@/lib/timeline-utils"

interface TicketTimelineProps {
  ticket: Ticket
}

export function TicketTimeline({ ticket }: TicketTimelineProps) {
  const { settings } = useSettings()

  const timelineSteps = useMemo(() => buildActorTimelineSteps(settings), [settings])

  const terminalStates = ["resolved", "rejected", "closed", "denied"]

  const relevantSteps = useMemo(() => {
    return timelineSteps.filter((step) => {
      const isTerminal = terminalStates.some((t) => step.status.toLowerCase().includes(t))
      if (isTerminal && ticket.status !== step.status) return false
      return true
    })
  }, [timelineSteps, ticket.status])

  const currentStepIndex = relevantSteps.findIndex((step) => step.status === ticket.status)

  const getStepStatus = (stepIndex: number) => {
    if (currentStepIndex < 0) return "upcoming"
    if (stepIndex < currentStepIndex) return "completed"
    if (stepIndex === currentStepIndex) return "current"
    return "upcoming"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Status Timeline</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Progress follows your school&apos;s roles (student → advisors → resolution).
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {relevantSteps.map((step, index) => {
            const stepStatus = getStepStatus(index)
            const StepIcon =
              step.status === "rejected" || step.label.toLowerCase().includes("reject")
                ? XCircle
                : step.status === "resolved" || step.label.toLowerCase().includes("resolv")
                  ? CheckCircle
                  : step.status === "submitted"
                    ? CheckCircle
                    : Clock

            const bgColor =
              stepStatus === "completed"
                ? "#dcfce7"
                : stepStatus === "current"
                  ? `${step.color}20`
                  : "#f3f4f6"

            const iconColor =
              stepStatus === "completed"
                ? "#16a34a"
                : stepStatus === "current"
                  ? step.color
                  : "#9ca3af"

            return (
              <div key={step.status} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="rounded-full p-2" style={{ backgroundColor: bgColor }}>
                    <StepIcon className="h-4 w-4" style={{ color: iconColor }} />
                  </div>
                  {index < relevantSteps.length - 1 && (
                    <div
                      className="w-px h-8 mt-2"
                      style={{ backgroundColor: stepStatus === "completed" ? "#bbf7d0" : "#e5e7eb" }}
                    />
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

                  {step.actorHint && (
                    <p className="text-xs text-muted-foreground mb-1">{step.actorHint}</p>
                  )}

                  {stepStatus === "completed" && index === 0 && (
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
                      <span>
                        Assigned to: {ticket.assignedUserName ?? ticket.assignedTo}
                      </span>
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
