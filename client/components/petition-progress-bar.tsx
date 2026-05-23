"use client"

import type { Ticket } from "@/lib/types"
import type { TenantSettings } from "@/lib/settings-context"
import { buildActorTimelineSteps } from "@/lib/timeline-utils"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { useMemo } from "react"

type PetitionProgressBarProps = {
  ticket: Ticket
  settings: TenantSettings
}

export function PetitionProgressBar({ ticket, settings }: PetitionProgressBarProps) {
  const steps = useMemo(() => buildActorTimelineSteps(settings), [settings])
  const currentIdx = steps.findIndex((s) => s.status === ticket.status)
  const progressIdx = currentIdx >= 0 ? currentIdx : steps.length - 1

  return (
    <div className="w-full mb-6 rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm font-medium mb-4">Petition progress</p>
      <div className="flex items-start w-full">
        {steps.map((step, idx) => {
          const done = currentIdx >= 0 && idx < currentIdx
          const current = idx === currentIdx
          const isTerminal = step.status === "resolved" || step.status === "rejected"
          const completed = done || (current && isTerminal)

          return (
            <div key={step.status} className="flex flex-1 flex-col items-center min-w-0 relative">
              {idx > 0 && (
                <div
                  className={cn(
                    "absolute top-4 h-0.5 -left-1/2 w-full -z-0",
                    done ? "bg-primary" : "bg-muted"
                  )}
                  style={{ width: "100%", left: "0" }}
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  completed && "border-primary bg-primary text-primary-foreground",
                  current && !completed && "border-primary bg-primary/10 text-primary",
                  !completed && !current && "border-muted-foreground/25 bg-muted text-muted-foreground"
                )}
              >
                {completed ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  "mt-2 text-[10px] sm:text-xs text-center leading-tight px-1 max-w-full truncate",
                  current ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
                title={step.label}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
