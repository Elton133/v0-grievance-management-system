"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { submitPetition } from "@/lib/petition-store"
import type { PetitionType, PetitionPriority } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, FileText, Send } from "lucide-react"
import Link from "next/link"

const petitionTypes: { value: PetitionType; label: string }[] = [
  { value: "academic_issue", label: "Academic Issue" },
  { value: "administrative_issue", label: "Administrative Issue" },
  { value: "facility_issue", label: "Facility Issue" },
  { value: "disciplinary_issue", label: "Disciplinary Issue" },
  { value: "financial_issue", label: "Financial Issue" },
  { value: "other", label: "Other" },
]

const priorityLevels: { value: PetitionPriority; label: string; description: string }[] = [
  { value: "low", label: "Low", description: "General inquiry or minor issue" },
  { value: "medium", label: "Medium", description: "Standard issue requiring attention" },
  { value: "high", label: "High", description: "Important issue affecting academics" },
  { value: "urgent", label: "Urgent", description: "Critical issue requiring immediate attention" },
]

const yearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Graduate", "PhD"]

export default function NewPetitionPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const [formData, setFormData] = useState({
    type: "" as PetitionType,
    priority: "medium" as PetitionPriority,
    subject: "",
    description: "",
    year: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

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

  // Redirect if not a student
  if (!user || user.role !== "student") {
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
        setError("Please fill in all required fields")
        return
      }

      const petition = submitPetition({
        studentId: user.studentId!,
        studentName: user.name,
        studentEmail: user.email,
        department: user.department!,
        year: formData.year,
        type: formData.type,
        priority: formData.priority,
        subject: formData.subject,
        description: formData.description,
      })

      router.push(`/petition/${petition.id}`)
    } catch (err) {
      setError("Failed to submit petition. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 rounded-lg p-2">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Submit New Petition</h1>
              <p className="text-muted-foreground">File a grievance or petition for review</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 ">
            <Card>
              <CardHeader>
                <CardTitle>Petition Details</CardTitle>
                <CardDescription>
                  Please provide detailed information about your grievance. All fields marked with * are required.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="type">Petition Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: PetitionType) => setFormData((prev) => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select petition type" />
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
                      <Label htmlFor="year">Academic Year *</Label>
                      <Select
                        value={formData.year}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, year: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your year" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority Level</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: PetitionPriority) => setFormData((prev) => ({ ...prev, priority: value }))}
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
                      placeholder="Brief summary of your petition"
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
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Student Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground">{user.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Student ID</Label>
                  <p className="text-sm text-muted-foreground">{user.studentId}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Department</Label>
                  <p className="text-sm text-muted-foreground">{user.department}</p>
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
                  <p>• Response time varies by petition type</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
