"use client"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { getTicketById, updateTicketDetails, deleteTicketById, type Ticket } from "@/lib/ticket-store"
import type { TicketType } from "@/lib/types"
import { TicketTimeline } from "@/components/ticket-timeline"
import { PetitionReviewPanel } from "@/components/petition-review-panel"
import { canUserReviewPetition } from "@/lib/reviewer-actions"
import {
  petitionSubjectLabel,
  petitionTypeLabel,
  PETITION_SUBJECTS,
  PETITION_TYPES,
} from "@/lib/petition-form-options"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Calendar, User, Mail, GraduationCap, AlertCircle, Edit, Trash2, Loader2 } from "lucide-react"
import { AppLoader } from "@/components/ui/app-loader"
import Link from "next/link"
import { useSettings } from "@/lib/settings-context"
import { formatTicketRef } from "@/lib/ticket-ref"

export default function TicketDetailPage() {
  const params = useParams()
  const { user, isLoading: authLoading } = useAuth()
  const { settings, getStatusLabel, getStatusColor, isSubmitterRole } = useSettings()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")
  
  const [editFormData, setEditFormData] = useState({
    subject: "",
    description: "",
    type: "" as TicketType,
  })

  useEffect(() => {
    const fetchTicket = async () => {
      if (!params.id) return
      
      setIsLoading(true)
      try {
        const data = await getTicketById(params.id as string)
        setTicket(data)
        if (data) {
          setEditFormData({
            subject: data.subject,
            description: data.description,
            type: data.type,
          })
        }
      } catch (error) {
        console.error("Error fetching ticket:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTicket()
  }, [params.id])

  const rejectionReason = useMemo(() => {
    if (!ticket || ticket.status !== "rejected") return null
    const rejected = (ticket.statusHistory ?? []).filter((h) => h.newStatus === "rejected")
    if (rejected.length === 0) return null
    const latest = rejected.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())[0]
    return latest.comment?.trim() || null
  }, [ticket])

  const handleEdit = async () => {
    if (!ticket) return
    
    setIsSaving(true)
    setError("")
    
    try {
      const updated = await updateTicketDetails(ticket.id, {
        ...editFormData,
        priority: "medium",
      })
      if (updated) {
        toast.success("Petition updated successfully!", {
          description: "Your changes have been saved.",
        })
        setTicket(updated)
        setIsEditDialogOpen(false)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update ticket"
      toast.error("Failed to update ticket", {
        description: errorMsg,
      })
      setError(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!ticket) return
    
    setIsDeleting(true)
    setError("")
    
    try {
      const success = await deleteTicketById(ticket.id)
      if (success) {
        toast.success("Ticket deleted successfully")
        router.push("/dashboard")
      } else {
        toast.error("Failed to delete ticket", {
          description: "Please try again.",
        })
        setError("Failed to delete ticket")
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete ticket"
      toast.error("Failed to delete ticket", {
        description: errorMsg,
      })
      setError(errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  const canEditOrDelete =
    !!user && isSubmitterRole(user.role) && ticket?.status === "submitted" && ticket?.submitterId === user?.id

  // Show loading state while checking auth or fetching ticket
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AppLoader message="Loading petition..." />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Petition not found.</AlertDescription>
            </Alert>
            <Button asChild className="w-full mt-4">
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if user can view this ticket
  // For submitters: must be the owner (compare user ID with ticket's submitterId which is the user UUID)
  // For staff: can view any ticket
  const canView = !user || !isSubmitterRole(user.role) || ticket.submitterId === user?.id

  if (!canView) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>You don&apos;t have permission to view this petition.</AlertDescription>
            </Alert>
            <Button asChild className="w-full mt-4">
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={user && isSubmitterRole(user.role) ? "/dashboard" : "/admin"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 break-words">{formatTicketRef(ticket)}</h1>
              <p className="text-sm sm:text-base text-muted-foreground break-words">
                {petitionSubjectLabel(ticket.subject)}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {canEditOrDelete && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditDialogOpen(true)}
                    className="flex-1 sm:flex-initial"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="flex-1 sm:flex-initial"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Badge className="text-xs" style={{ backgroundColor: getStatusColor(ticket.status), color: '#fff' }}>
                  {getStatusLabel(ticket.status).toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Petition details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground leading-relaxed">{ticket.description}</p>
                </div>

                {ticket.status === "rejected" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">Rejection reason: </span>
                      {rejectionReason ?? "No reason was recorded."}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-1">Petition type</h4>
                    <p className="text-sm text-muted-foreground">{petitionTypeLabel(ticket.type)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Level</h4>
                    <p className="text-sm text-muted-foreground">{ticket.year}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TicketTimeline ticket={ticket} />

            {user && canUserReviewPetition(user.role, settings.rolesConfig) && (
              <PetitionReviewPanel ticket={ticket} userRole={user.role} onUpdated={setTicket} />
            )}
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Student information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{ticket.submitterName}</p>
                    <p className="text-xs text-muted-foreground">Student ID</p>
                    <p className="text-sm text-muted-foreground">
                      {ticket.submitterIndexNumber ?? (ticket.submitterId === user?.id ? user?.submitterId : undefined) ?? "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{ticket.submitterEmail}</p>
                </div>

                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Department: {ticket.group}</p>
                    <p className="text-sm text-muted-foreground">Level: {ticket.year}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Petition info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Submitted</p>
                    <p className="text-sm text-muted-foreground">{ticket.submittedAt.toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">{ticket.updatedAt.toLocaleDateString()}</p>
                  </div>
                </div>

                {(ticket.assignedToUserId || ticket.assignedUserName || ticket.assignedTo) && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Assigned To</p>
                      <p className="text-sm text-muted-foreground">
                        {ticket.assignedUserName ?? ticket.assignedTo}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {ticket.status === "submitted" && user && isSubmitterRole(user.role) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your petition has been submitted successfully. You will receive email updates as it progresses through
                  the review process.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>Edit petition</DialogTitle>
            <DialogDescription>
              Update your petition details. You can only edit petitions that are still in submitted status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject *</Label>
              <Select
                value={editFormData.subject}
                onValueChange={(value) => setEditFormData({ ...editFormData, subject: value })}
              >
                <SelectTrigger id="edit-subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {PETITION_SUBJECTS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Describe your grievance in detail"
                rows={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-type">Petition type *</Label>
              <Select
                value={editFormData.type}
                onValueChange={(value) => setEditFormData({ ...editFormData, type: value as TicketType })}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PETITION_TYPES.map((type) => (
                    <SelectItem key={type.key} value={type.key}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSaving || !editFormData.subject || !editFormData.description}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>Delete petition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this petition? This action cannot be undone. You can only delete petitions still in submitted status.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete petition"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
