import type { Ticket } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, ArrowRight, XCircle, User } from "lucide-react"
import { useSettings } from "@/lib/settings-context"

interface TicketTimelineProps {
  ticket: Ticket
}

export function TicketTimeline({ ticket }: TicketTimelineProps) {
  const { settings } = useSettings()

  // Build dynamic steps from settings, maintaining array order
  const timelineSteps = (settings?.statusLabelsConfig || []).map(config => {
    let icon = ArrowRight
    const key = config.key.toLowerCase()
    
    if (key.includes("submit")) icon = CheckCircle
    else if (key.includes("review") || key.includes("progress")) icon = Clock
    else if (key.includes("resolv") || key.includes("approv") || key.includes("done")) icon = CheckCircle
    else if (key.includes("reject") || key.includes("den") || key.includes("fail")) icon = XCircle
    
    return {
      status: config.key,
      label: config.label,
      icon: icon,
      color: config.color
    }
  })

  // Determine current step index
  const currentStepIndex = timelineSteps.findIndex((step) => step.status === ticket.status)

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) return "completed"
    if (stepIndex === currentStepIndex) return "current"
    return "upcoming"
  }

  // Filter out terminal states if not applicable
  const terminalStates = ["resolved", "rejected", "closed", "denied"]
  const relevantSteps = timelineSteps.filter((step) => {
    const isTerminal = terminalStates.some(t => step.status.toLowerCase().includes(t))
    if (isTerminal && ticket.status !== step.status) return false
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

            const bgColor = stepStatus === "completed" 
              ? "#dcfce7" // green bg
              : stepStatus === "current"
                ? `${step.color}20` // 20% opacity of dynamic color
                : "#f3f4f6" // gray bg

            const iconColor = stepStatus === "completed"
              ? "#16a34a" // green text
              : stepStatus === "current"
                ? step.color
                : "#9ca3af" // gray text

            return (
              <div key={step.status} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className="rounded-full p-2"
                    style={{ backgroundColor: bgColor }}
                  >
                    <StepIcon
                      className="h-4 w-4"
                      style={{ color: iconColor }}
                    />
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

