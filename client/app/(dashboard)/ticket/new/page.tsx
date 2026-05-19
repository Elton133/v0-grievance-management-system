"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { submitTicket } from "@/lib/ticket-store"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, FileText, Send, Loader2 } from "lucide-react"
import Link from "next/link"
import { FileUpload } from "@/components/file-upload"
import { uploadPetitionAttachments } from "@/lib/attachment-upload"
import {
  PETITION_TYPES,
  PETITION_SUBJECTS,
  ACADEMIC_LEVELS,
} from "@/lib/petition-form-options"

export default function NewPetitionPage() {
  const { user, isLoading } = useAuth()
  const { isSubmitterRole } = useSettings()
  const router = useRouter()

  const [formData, setFormData] = useState({
    type: "",
    subject: "",
    description: "",
    year: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !isSubmitterRole(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>Only students can submit petitions.</AlertDescription>
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
        return
      }

      const petition = await submitTicket({
        submitterId: user.submitterId!,
        submitterName: user.name,
        submitterEmail: user.email,
        group: user.group!,
        year: formData.year,
        type: formData.type,
        priority: "medium",
        subject: formData.subject,
        description: formData.description,
      })

      if (selectedFiles.length > 0 && petition.id) {
        const { uploaded, errors } = await uploadPetitionAttachments(petition.id, selectedFiles)
        if (uploaded === 0 && errors.length > 0) {
          toast.error("Petition saved, but petition attachments failed to upload.", {
            description: errors.slice(0, 2).join(" "),
          })
        } else if (errors.length > 0) {
          toast.warning(`Petition saved. ${uploaded} file(s) uploaded; ${errors.length} failed.`, {
            description: errors[0],
          })
        }
      }

      toast.success("Petition submitted successfully!")
      router.push(`/ticket/${petition.id}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to submit petition."
      toast.error(errorMessage)
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Submit New Petition</h1>
            <p className="text-muted-foreground">Fee or results petitions for your department</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Petition details</CardTitle>
            <CardDescription>All fields marked * are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="petition-type">Petition type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger id="petition-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PETITION_TYPES.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">Level *</Label>
                  <Select
                    value={formData.year}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, year: value }))}
                  >
                    <SelectTrigger id="level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACADEMIC_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Select
                  value={formData.subject}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, subject: value }))}
                >
                  <SelectTrigger id="subject">
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
                <Label htmlFor="description">Details *</Label>
                <Textarea
                  id="description"
                  name="petition-details"
                  autoComplete="off"
                  placeholder="Describe your issue in detail..."
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Petition
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="font-medium">Name:</span> {user.name}
            </p>
            <p>
              <span className="font-medium">Student ID:</span> {user.submitterId}
            </p>
            <p>
              <span className="font-medium">Department:</span> {user.group}
            </p>
            <p>
              <span className="font-medium">Email:</span> {user.email}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
