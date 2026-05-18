"use client"

import type { Ticket } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSettings } from "@/lib/settings-context"
import { useMemo } from "react"
import { buildActorTimelineSteps } from "@/lib/timeline-utils"
import { getTimelineStepHint } from "@/lib/reviewer-actions"
import { buildActivityFeed } from "@/lib/activity-feed"
import { petitionSubjectLabel } from "@/lib/petition-form-options"
import { CheckCircle, Clock, MessageSquare, XCircle, GitBranch } from "lucide-react"

interface TicketTimelineProps {
  ticket: Ticket
}

export function TicketTimeline({ ticket }: TicketTimelineProps) {
  const { settings, getStatusLabel } = useSettings()
  const timelineSteps = useMemo(() => buildActorTimelineSteps(settings), [settings])
  const currentStepIndex = timelineSteps.findIndex((s) => s.status === ticket.status)
  const activity = useMemo(
    () => buildActivityFeed(ticket, getStatusLabel),
    [ticket, getStatusLabel]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Petition progress</CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Subject: {petitionSubjectLabel(ticket.subject)} · Level {ticket.year}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {timelineSteps.map((step, index) => {
            const done = currentStepIndex >= 0 && index < currentStepIndex
            const current = index === currentStepIndex
            const hint =
              getTimelineStepHint(step.status, index, currentStepIndex, ticket, settings) ??
              step.actorHint
            const Icon =
              step.status === "rejected" ? XCircle : step.status === "resolved" ? CheckCircle : Clock
            return (
              <div key={step.status} className="flex gap-3">
                <Icon
                  className={`h-5 w-5 mt-0.5 shrink-0 ${
                    done ? "text-green-600" : current ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <div>
                  <p
                    className={`font-medium ${current ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {step.label}
                    {current && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Current
                      </Badge>
                    )}
                  </p>
                  {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Activity log</h4>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => {
                const Icon = item.kind === "comment" ? MessageSquare : GitBranch
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 text-sm ${
                      item.kind === "status" ? "bg-muted/30" : "bg-background"
                    }`}
                  >
                    <div className="flex gap-2 items-start">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.actorRole} · {item.actorName} · {item.at.toLocaleString()}
                        </p>
                        {item.body && (
                          <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{item.body}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
