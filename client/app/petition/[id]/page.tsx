"use client"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { getPetitionById, updatePetitionDetails, deletePetitionById, type Petition } from "@/lib/petition-store"
import { PetitionTimeline } from "@/components/petition-timeline"
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
import type { PetitionType, PetitionPriority } from "@/lib/types"

const statusColors = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  forwarded_to_hod: "bg-purple-100 text-purple-800",
  forwarded_to_registrar: "bg-orange-100 text-orange-800",
  resolved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
}

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
}

const petitionTypes: { value: PetitionType; label: string }[] = [
  { value: "academic_issue", label: "Academic Issue" },
  { value: "administrative_issue", label: "Administrative Issue" },
  { value: "facility_issue", label: "Facility Issue" },
  { value: "disciplinary_issue", label: "Disciplinary Issue" },
  { value: "financial_issue", label: "Financial Issue" },
  { value: "other", label: "Other" },
]

const priorityLevels: { value: PetitionPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export default function PetitionDetailPage() {
  const params = useParams()
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [petition, setPetition] = useState<Petition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")
  
  const [editFormData, setEditFormData] = useState({
    subject: "",
    description: "",
    type: "" as PetitionType,
    priority: "medium" as PetitionPriority,
  })

  useEffect(() => {
    const fetchPetition = async () => {
      if (!params.id) return
      
      setIsLoading(true)
      try {
        const data = await getPetitionById(params.id as string)
        setPetition(data)
        if (data) {
          setEditFormData({
            subject: data.subject,
            description: data.description,
            type: data.type,
            priority: data.priority,
          })
        }
      } catch (error) {
        console.error("Error fetching petition:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPetition()
  }, [params.id])

  const handleEdit = async () => {
    if (!petition) return
    
    setIsSaving(true)
    setError("")
    
    try {
      const updated = await updatePetitionDetails(petition.id, editFormData)
      if (updated) {
        toast.success("Petition updated successfully!", {
          description: "Your changes have been saved.",
        })
        setPetition(updated)
        setIsEditDialogOpen(false)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update petition"
      toast.error("Failed to update petition", {
        description: errorMsg,
      })
      setError(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!petition) return
    
    setIsDeleting(true)
    setError("")
    
    try {
      const success = await deletePetitionById(petition.id)
      if (success) {
        toast.success("Petition deleted successfully")
        router.push("/dashboard")
      } else {
        toast.error("Failed to delete petition", {
          description: "Please try again.",
        })
        setError("Failed to delete petition")
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete petition"
      toast.error("Failed to delete petition", {
        description: errorMsg,
      })
      setError(errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  const canEditOrDelete = user?.role === "student" && petition?.status === "submitted" && petition?.studentId === user?.id

  // Show loading state while checking auth or fetching petition
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AppLoader message="Loading petition..." />
      </div>
    )
  }

  if (!petition) {
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

  // Check if user can view this petition
  // For students: must be the owner (compare user ID with petition's studentId which is the user UUID)
  // For staff: can view any petition
  const canView = user?.role !== "student" || petition.studentId === user?.id

  if (!canView) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>You don't have permission to view this petition.</AlertDescription>
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
            <Link href={user?.role === "student" ? "/dashboard" : "/admin"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 break-words">Petition #{petition.id.slice(0, 8)}...</h1>
              <p className="text-sm sm:text-base text-muted-foreground break-words">{petition.subject}</p>
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
                <Badge className={`${statusColors[petition.status]} text-xs`}>
                  {petition.status.replace(/_/g, " ").toUpperCase()}
                </Badge>
                <Badge className={`${priorityColors[petition.priority]} text-xs`}>{petition.priority.toUpperCase()}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Petition Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground leading-relaxed">{petition.description}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-1">Type</h4>
                    <p className="text-sm text-muted-foreground capitalize">{petition.type.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Priority</h4>
                    <p className="text-sm text-muted-foreground capitalize">{petition.priority}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <PetitionTimeline petition={petition} />
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Student Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{petition.studentName}</p>
                    <p className="text-sm text-muted-foreground">{petition.studentId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{petition.studentEmail}</p>
                </div>

                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{petition.department}</p>
                    <p className="text-sm text-muted-foreground">{petition.year}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Petition Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Submitted</p>
                    <p className="text-sm text-muted-foreground">{petition.submittedAt.toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">{petition.updatedAt.toLocaleDateString()}</p>
                  </div>
                </div>

                {petition.assignedTo && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Assigned To</p>
                      <p className="text-sm text-muted-foreground">{petition.assignedTo}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {petition.status === "submitted" && user?.role === "student" && (
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
            <DialogTitle>Edit Petition</DialogTitle>
            <DialogDescription>
              Update your petition details. You can only edit petitions that are still in "submitted" status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject *</Label>
              <Input
                id="edit-subject"
                value={editFormData.subject}
                onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                placeholder="Enter petition subject"
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
                  onValueChange={(value) => setEditFormData({ ...editFormData, type: value as PetitionType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {petitionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
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
                  onValueChange={(value) => setEditFormData({ ...editFormData, priority: value as PetitionPriority })}
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
            <DialogTitle>Delete Petition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this petition? This action cannot be undone. You can only delete petitions that are still in "submitted" status.
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
                "Delete Petition"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
