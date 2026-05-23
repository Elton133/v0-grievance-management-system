"use client"

import type { Ticket } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSettings } from "@/lib/settings-context"
import { useMemo } from "react"
import { buildActivityFeed } from "@/lib/activity-feed"
import { MessageSquare, GitBranch } from "lucide-react"

interface TicketTimelineProps {
  ticket: Ticket
}

export function TicketTimeline({ ticket }: TicketTimelineProps) {
  const { getStatusLabel } = useSettings()
  const activity = useMemo(
    () => buildActivityFeed(ticket, getStatusLabel),
    [ticket, getStatusLabel]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity log</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
