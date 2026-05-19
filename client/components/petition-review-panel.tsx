"use client"

import { useState } from "react"
import type { Ticket } from "@/lib/types"
import { useSettings } from "@/lib/settings-context"
import {
  getPetitionReviewActions,
  getPetitionReviewGuide,
  canUserReviewPetition,
  canUserActOnPetition,
  getOwnerLabelForStatus,
} from "@/lib/reviewer-actions"
import { updateTicketStatus, getTicketById } from "@/lib/ticket-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, MessageSquare, ArrowRight, Info } from "lucide-react"
import { toast } from "sonner"

type PetitionReviewPanelProps = {
  ticket: Ticket
  userRole: string
  onUpdated: (ticket: Ticket) => void
}

export function PetitionReviewPanel({ ticket, userRole, onUpdated }: PetitionReviewPanelProps) {
  const { settings } = useSettings()
  const [comment, setComment] = useState("")
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!canUserReviewPetition(userRole, settings.rolesConfig)) return null

  const actions = getPetitionReviewActions(ticket, userRole, settings.rolesConfig)
  const guide = getPetitionReviewGuide(ticket, userRole, settings.rolesConfig)
  const canAct = canUserActOnPetition(ticket, userRole, settings.rolesConfig)
  const staffComments = (ticket.comments ?? []).filter(
    (c) => c.authorRole !== "student" && c.authorId !== ticket.submitterId
  )

  const refresh = async () => {
    const refreshed = await getTicketById(ticket.id)
    if (refreshed) onUpdated(refreshed)
  }

  const runAction = async (action: (typeof actions)[0]) => {
    const isTerminal =
      action.status === "resolved" || action.status === "rejected"
    if (isTerminal && ticket.status !== "forwarded_to_registrar") {
      toast.error(
        "This petition must be forwarded to the Registrar before it can be approved or rejected.",
        {
          description:
            ticket.status === "forwarded_to_hod"
              ? "The Head of Department still needs to review and forward it."
              : undefined,
        }
      )
      return
    }
    if (isTerminal && userRole === "hod") {
      toast.error("Only the Registrar can approve or reject. Forward the petition to the Registrar first.")
      return
    }

    const trimmed = comment.trim()
    if (action.requiresComment && !trimmed) {
      toast.error(
        action.status === "rejected"
          ? "Please enter a rejection reason"
          : "Please write a comment before forwarding"
      )
      return
    }

    setIsSubmitting(true)
    setPendingAction(action.id)
    try {
      const ok = await updateTicketStatus(ticket.id, action.status, trimmed || undefined)
      if (!ok) {
        toast.error("Could not update petition")
        return
      }
      toast.success(
        action.status === "resolved"
          ? "Petition resolved"
          : action.status === "rejected"
            ? "Petition rejected"
            : "Forwarded to the next reviewer"
      )
      setComment("")
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    } finally {
      setIsSubmitting(false)
      setPendingAction(null)
    }
  }

  const primaryForward = actions.find((a) => a.id.startsWith("fwd"))
  const registrarActions = actions.filter((a) => a.id === "resolve" || a.id === "reject")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {guide.title}
        </CardTitle>
        {!guide.readOnlyNote && (
          <CardDescription>
            Only one forward action per stage. Write your comment, then use the button below.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {guide.readOnlyNote && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{guide.readOnlyNote}</AlertDescription>
          </Alert>
        )}

        {staffComments.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Previous staff comments</p>
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-2">
              {staffComments.map((c) => (
                <div key={c.id} className="rounded-md bg-background p-3 text-sm">
                  <p className="font-medium">
                    {c.authorName}{" "}
                    <span className="text-muted-foreground font-normal capitalize">
                      · {c.authorRole.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted-foreground font-normal text-xs ml-2">
                      {c.createdAt.toLocaleString()}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {canAct && guide.steps.length > 0 && (
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground rounded-lg border border-dashed p-4 bg-muted/20">
            {guide.steps.map((step, i) => (
              <li key={i} className="pl-1">
                {step}
              </li>
            ))}
          </ol>
        )}

        {canAct && (
          <>
            <div className="space-y-2">
              <label htmlFor="review-comment" className="text-sm font-medium">
                {userRole === "registrar" ? "Your note" : "Your comment"}{" "}
                {primaryForward || registrarActions.some((a) => a.requiresComment) ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-muted-foreground font-normal">(optional for approval)</span>
                )}
              </label>
              <Textarea
                id="review-comment"
                placeholder={
                  userRole === "registrar"
                    ? "Required if rejecting. Optional if approving."
                    : "Explain your review for the student and the next reviewer…"
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                disabled={isSubmitting}
              />
            </div>

            {primaryForward && (
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Ready to send onward?</p>
                <p className="text-xs text-muted-foreground">{primaryForward.description}</p>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={isSubmitting}
                  onClick={() => void runAction(primaryForward)}
                >
                  {isSubmitting && pendingAction === primaryForward.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {primaryForward.label}
                </Button>
              </div>
            )}

            {registrarActions.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Final decision</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {registrarActions.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      variant={action.variant ?? "outline"}
                      className="flex-1"
                      disabled={isSubmitting}
                      onClick={() => void runAction(action)}
                    >
                      {isSubmitting && pendingAction === action.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {action.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rejecting requires a reason in the comment box above.
                </p>
              </div>
            )}
          </>
        )}

        {!canAct && !guide.readOnlyNote && (
          <p className="text-sm text-muted-foreground">
            With {getOwnerLabelForStatus(ticket.status, settings.rolesConfig)} now.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
