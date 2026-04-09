"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { submitTicket } from "@/lib/ticket-store"
import type { TicketType, TicketPriority } from "@/lib/types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, FileText, Send } from "lucide-react"
import Link from "next/link"
import { FileUpload } from "@/components/file-upload"
import { uploadFileToSupabase } from "@/lib/file-upload"
import { ticketApi } from "@/lib/api"
import { useSettings } from "@/lib/settings-context"

const priorityLevels: { value: TicketPriority; label: string; description: string }[] = [
  { value: "low", label: "Low", description: "General inquiry or minor issue" },
  { value: "medium", label: "Medium", description: "Standard issue requiring attention" },
  { value: "high", label: "High", description: "Important issue affecting academics" },
  { value: "urgent", label: "Urgent", description: "Critical issue requiring immediate attention" },
]

export default function NewTicketPage() {
  const { user, isLoading } = useAuth()
  const { settings, isSubmitterRole } = useSettings()
  const router = useRouter()

  const [formData, setFormData] = useState({
    type: "" as TicketType,
    priority: "medium" as TicketPriority,
    subject: "",
    description: "",
    year: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin mx-auto mb-4 rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !isSubmitterRole(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>Only students can submit tickets.</AlertDescription>
            </Alert>
            <Button asChild className="w-full mt-4">
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      if (!formData.type || !formData.subject || !formData.description || !formData.year) {
        toast.error("Please fill in all required fields")
        setError("Please fill in all required fields")
        setIsSubmitting(false)
        return
      }

      const ticket = await submitTicket({
        submitterId: user.submitterId!,
        submitterName: user.name,
        submitterEmail: user.email,
        group: user.group!,
        year: formData.year,
        type: formData.type,
        priority: formData.priority,
        subject: formData.subject,
        description: formData.description,
      })

      // Upload files to Supabase Storage and create attachment records
      if (selectedFiles.length > 0 && ticket.id && user.id) {
        try {
          // Upload files to Supabase Storage
          const uploadPromises = selectedFiles.map((file) =>
            uploadFileToSupabase(file, ticket.id, user.id)
          )
          const uploadedResults = await Promise.all(uploadPromises)
          const successfulUploads = uploadedResults.filter((result) => result !== null)

          // Create attachment records in database
          if (successfulUploads.length > 0) {
            const attachmentPromises = successfulUploads.map((file) =>
              ticketApi.addAttachment(ticket.id, {
                fileName: file!.fileName,
                fileUrl: file!.url,
                fileSize: file!.fileSize,
                mimeType: file!.mimeType,
              })
            )
            await Promise.all(attachmentPromises)
            toast.success(`Successfully uploaded ${successfulUploads.length} attachment(s)`)
          }

          if (successfulUploads.length < selectedFiles.length) {
            toast.warning(
              `Ticket created but ${selectedFiles.length - successfulUploads.length} file(s) failed to upload`
            )
          }
        } catch (err) {
          console.error("Error uploading attachments:", err)
          toast.warning("Ticket created but attachments failed to upload")
        }
      }

      toast.success("Ticket submitted successfully!", {
        description: "Your grievance has been submitted and is awaiting review.",
      })
      router.push(`/ticket/${ticket.id}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to submit ticket. Please try again."
      toast.error("Failed to submit ticket", {
        description: errorMessage,
      })
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Submit New Ticket</h1>
              <p className="text-sm sm:text-base text-muted-foreground">File a grievance or ticket for review</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Details</CardTitle>
                <CardDescription>
                  Please provide detailed information about your grievance. All fields marked with * are required.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="type">Ticket Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: TicketType) => setFormData((prev) => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ticket type" />
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
                      <Label htmlFor="year">Year / Level *</Label>
                      <Input
                        id="year"
                        placeholder="e.g. 1st Year, Level 2, or N/A"
                        value={formData.year}
                        onChange={(e) => setFormData((prev) => ({ ...prev, year: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority Level</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: TicketPriority) => setFormData((prev) => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityLevels.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            <div>
                              <div className="font-medium">{priority.label}</div>
                              <div className="text-sm text-muted-foreground">{priority.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="Brief summary of your ticket"
                      value={formData.subject}
                      onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Detailed Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide a detailed description of your grievance, including relevant dates, people involved, and any steps you've already taken..."
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      rows={8}
                      required
                    />
                  </div>

                  <FileUpload
                    onFilesChange={setSelectedFiles}
                    selectedFiles={selectedFiles}
                    disabled={isSubmitting}
                  />

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                      {isSubmitting ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Submit Ticket
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/dashboard">Cancel</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submitter Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground">{user.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Submitter ID</Label>
                  <p className="text-sm text-muted-foreground">{user.submitterId}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Department</Label>
                  <p className="text-sm text-muted-foreground">{user.group}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <p>• Be specific and factual in your description</p>
                  <p>• Include relevant dates and documentation</p>
                  <p>• Choose the appropriate priority level</p>
                  <p>• You will receive updates via email</p>
                  <p>• Response time varies by ticket type</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
