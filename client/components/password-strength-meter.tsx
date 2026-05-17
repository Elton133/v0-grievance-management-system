"use client"

import { cn } from "@/lib/utils"
import { getPasswordStrengthState } from "@/lib/password-policy"
import { Check, Circle } from "lucide-react"

type PasswordStrengthMeterProps = {
  password: string
  className?: string
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const { checks, label, barPercent, score, maxScore } = getPasswordStrengthState(password)

  if (!password) return null

  const barColor =
    score <= 2 ? "bg-destructive" : score <= 4 ? "bg-amber-500" : "bg-emerald-600"

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Password strength</span>
        <span
          className={cn(
            "font-medium",
            score <= 2 && "text-destructive",
            score === 3 && "text-amber-600",
            score >= 4 && "text-emerald-700"
          )}
        >
          {label}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-300 ease-out", barColor)}
          style={{ width: `${barPercent}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={maxScore}
        />
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {checks.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            {c.met ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
            )}
            <span className={cn(c.met && "text-foreground")}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
