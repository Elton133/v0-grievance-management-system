"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { registrationSchema, type RegistrationFormData } from "@/lib/validation"

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegistrationFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
    studentId: "",
    department: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationFormData, string>>>({})
  const [error, setError] = useState("")
  const { register, isLoading } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setErrors({})

    // Validate with Zod
    const validationResult = registrationSchema.safeParse(formData)

    if (!validationResult.success) {
      const fieldErrors: Partial<Record<keyof RegistrationFormData, string>> = {}
      validationResult.error.errors.forEach((err) => {
        const path = err.path[0] as keyof RegistrationFormData
        if (path) {
          fieldErrors[path] = err.message
        }
      })
      setErrors(fieldErrors)

      // Show first error as toast
      const firstError = validationResult.error.errors[0]
      toast.error(firstError.message)
      return
    }

    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      studentId: formData.role === "student" ? formData.studentId : undefined,
      department: formData.department || undefined,
    })

    if (result.success) {
      toast.success("Account created successfully!", {
        description: "Redirecting to login page...",
      })
      // Redirect to login page with success message
      router.push("/login?registered=true")
    } else {
      const errorMsg = result.error || "Registration failed. Please try again."
      toast.error("Registration failed", {
        description: errorMsg,
      })
      setError(errorMsg)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="School Logo" width={120} height={120} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Student Grievance Portal</h1>
          <p className="text-muted-foreground mt-2">Create a new account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Register to access the grievance management system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (errors.name) setErrors({ ...errors, name: undefined })
                  }}
                  required
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@st.rmu.edu.gh"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    if (errors.email) setErrors({ ...errors, email: undefined })
                  }}
                  required
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Must be from @st.rmu.edu.gh or @rmu.edu.gh
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value, studentId: "", department: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="class_advisor">Class Advisor</SelectItem>
                    <SelectItem value="hod">Head of Department</SelectItem>
                    <SelectItem value="registrar">Registrar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === "student" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="studentId">Student ID *</Label>
                    <Input
                      id="studentId"
                      type="text"
                      placeholder="BIT0001526"
                      value={formData.studentId || ""}
                      onChange={(e) => {
                        setFormData({ ...formData, studentId: e.target.value })
                        if (errors.studentId) setErrors({ ...errors, studentId: undefined })
                      }}
                      required
                    />
                    {errors.studentId && (
                      <p className="text-sm text-destructive">{errors.studentId}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) => {
                        setFormData({ ...formData, department: value, studentId: "" })
                        if (errors.department) setErrors({ ...errors, department: undefined })
                        if (errors.studentId) setErrors({ ...errors, studentId: undefined })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ICT">ICT</SelectItem>
                        <SelectItem value="Transport">Transport</SelectItem>
                        <SelectItem value="Marine Electrical & Electronic Engineering">Marine Electrical & Electronic Engineering</SelectItem>
                        <SelectItem value="Nautical Science">Nautical Science</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.department && (
                      <p className="text-sm text-destructive">{errors.department}</p>
                    )}
                  </div>
                </>
              )}

              {formData.role !== "student" && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(value) => {
                      setFormData({ ...formData, department: value })
                      if (errors.department) setErrors({ ...errors, department: undefined })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ICT">ICT</SelectItem>
                      <SelectItem value="Transport">Transport</SelectItem>
                      <SelectItem value="Marine Electrical & Electronic Engineering">Marine Electrical & Electronic Engineering</SelectItem>
                      <SelectItem value="Nautical Science">Nautical Science</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.department && (
                    <p className="text-sm text-destructive">{errors.department}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value })
                    if (errors.password) setErrors({ ...errors, password: undefined })
                  }}
                  required
                  minLength={6}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
                <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, confirmPassword: e.target.value })
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined })
                  }}
                  required
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

