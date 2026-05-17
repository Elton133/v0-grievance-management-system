"use client"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { getTicketById, updateTicketDetails, deleteTicketById, type Ticket } from "@/lib/ticket-store"
import type { TicketType, TicketPriority } from "@/lib/types"
import { TicketTimeline } from "@/components/ticket-timeline"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Calendar, User, Mail, GraduationCap, AlertCircle, Edit, Trash2, Loader2 } from "lucide-react"
import { AppLoader } from "@/components/ui/app-loader"
import Link from "next/link"
import { useSettings } from "@/lib/settings-context"
import { formatTicketRef } from "@/lib/ticket-ref"

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
}

const priorityLevels: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export default function TicketDetailPage() {
  const params = useParams()
  const { user, isLoading: authLoading } = useAuth()
  const { settings, getStatusLabel, getStatusColor, getTicketTypeLabel, isSubmitterRole } = useSettings()
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
    priority: "medium" as TicketPriority,
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
            priority: data.priority,
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

  const handleEdit = async () => {
    if (!ticket) return
    
    setIsSaving(true)
    setError("")
    
    try {
      const updated = await updateTicketDetails(ticket.id, editFormData)
      if (updated) {
        toast.success("Ticket updated successfully!", {
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
        <AppLoader message="Loading ticket..." />
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
              <AlertDescription>Ticket not found.</AlertDescription>
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
              <AlertDescription>You don't have permission to view this ticket.</AlertDescription>
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
              <p className="text-sm sm:text-base text-muted-foreground break-words">{ticket.subject}</p>
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
                <Badge className={`${priorityColors[ticket.priority]} text-xs`}>{ticket.priority.toUpperCase()}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground leading-relaxed">{ticket.description}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-1">Type</h4>
                    <p className="text-sm text-muted-foreground capitalize">{getTicketTypeLabel(ticket.type)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Priority</h4>
                    <p className="text-sm text-muted-foreground capitalize">{ticket.priority}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TicketTimeline ticket={ticket} />
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
                    <p className="text-sm font-medium">{ticket.group}</p>
                    <p className="text-sm text-muted-foreground">{ticket.year}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ticket Info</CardTitle>
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
                  Your ticket has been submitted successfully. You will receive email updates as it progresses through
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
            <DialogTitle>Edit Ticket</DialogTitle>
            <DialogDescription>
              Update your ticket details. You can only edit tickets that are still in "submitted" status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject *</Label>
              <Input
                id="edit-subject"
                value={editFormData.subject}
                onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                placeholder="Enter ticket subject"
                required
              />
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Type *</Label>
                <Select
                  value={editFormData.type}
                  onValueChange={(value) => setEditFormData({ ...editFormData, type: value as TicketType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings?.ticketTypesConfig?.map((type) => (
                      <SelectItem key={type.key} value={type.key}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority *</Label>
                <Select
                  value={editFormData.priority}
                  onValueChange={(value) => setEditFormData({ ...editFormData, priority: value as TicketPriority })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityLevels.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <DialogTitle>Delete Ticket</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this ticket? This action cannot be undone. You can only delete tickets that are still in "submitted" status.
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
                "Delete Ticket"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
