"use client"

import type React from "react"
import { useMemo, useState } from "react"
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
import { useSettings } from "@/lib/settings-context"
import {
  createRegistrationFormSchema,
  registrationRoleRequiresGroup,
  getLiveStudentIdPrefixError,
  type RegistrationFormData,
} from "@/lib/validation"
import { departmentSelectOptions } from "@/lib/rmu-departments"
import { getLiveRosterRegistrationIssues, rosterValidationEnabledClient } from "@/lib/studentRosterClient"
import { REGISTRATION_PASSWORD_HINT } from "@/lib/password-policy"
import { PasswordStrengthMeter } from "@/components/password-strength-meter"
import Link from "next/link"

function isPublicRegistrableRole(role: { key: string; isSubmitter?: boolean; groupScoped?: boolean }) {
  const key = role.key.toLowerCase()
  if (key.includes("registrar") || key.includes("admin")) return false
  return role.isSubmitter === true || role.groupScoped !== false
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegistrationFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
    submitterId: "",
    group: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationFormData, string>>>({})
  const [error, setError] = useState("")
  const { register, isLoading } = useAuth()
  const { settings, isSubmitterRole } = useSettings()
  const router = useRouter()

  const publicRoleOptions = useMemo(
    () => (settings?.rolesConfig ?? []).filter(isPublicRegistrableRole),
    [settings?.rolesConfig]
  )

  const publicRegistrationSettings = useMemo(
    () => ({ ...settings, rolesConfig: publicRoleOptions }),
    [settings, publicRoleOptions]
  )

  const registrationFormSchema = useMemo(
    () => createRegistrationFormSchema(publicRegistrationSettings),
    [publicRegistrationSettings]
  )

  const liveStudentIdPrefixError = useMemo(
    () => getLiveStudentIdPrefixError(formData, publicRegistrationSettings),
    [formData.role, formData.submitterId, formData.group, publicRegistrationSettings]
  )

  const rosterIssues = useMemo(
    () => getLiveRosterRegistrationIssues(formData, publicRegistrationSettings),
    [formData.name, formData.role, formData.submitterId, formData.group, publicRegistrationSettings]
  )

  const nameMessage = errors.name ?? rosterIssues.name
  const groupMessage = errors.group ?? rosterIssues.group
  const submitterIdMessage = errors.submitterId ?? rosterIssues.submitterId ?? liveStudentIdPrefixError

  const studentBlockingIssue =
    isSubmitterRole(formData.role) &&
    !!(liveStudentIdPrefixError || rosterIssues.name || rosterIssues.group || rosterIssues.submitterId)

  const availableGroups = departmentSelectOptions(settings?.groupPrefixes)
  const needsDepartment = registrationRoleRequiresGroup(formData.role, publicRegistrationSettings)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setErrors({})

    // Validate with Zod
    const validationResult = registrationFormSchema.safeParse(formData)

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

    const needsGroup = registrationRoleRequiresGroup(formData.role, publicRegistrationSettings)
    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      submitterId: isSubmitterRole(formData.role) ? formData.submitterId : undefined,
      group: needsGroup ? formData.group?.trim() || undefined : undefined,
    })

    if (result.success) {
      toast.success("Account created successfully!", {
        description: "Redirecting to login page...",
      })
      if (result.warning) {
        toast.warning("Verification email", { description: result.warning })
      }
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
            <Image 
              src="/logo.png" 
              alt={settings?.organizationName || "School Logo"} 
              width={120} 
              height={120} 
              className="object-contain" 
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{settings?.organizationName || "Grievance Portal"}</h1>
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
                  aria-invalid={!!nameMessage}
                  aria-describedby={nameMessage ? "name-hint" : undefined}
                  className={nameMessage ? "border-destructive focus-visible:ring-destructive" : undefined}
                />
                {nameMessage && (
                  <p id="name-hint" className="text-sm text-destructive" role="alert">
                    {nameMessage}
                  </p>
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
                {settings?.allowedEmailDomains && settings.allowedEmailDomains.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Must be from {settings.allowedEmailDomains.join(" or ")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value, submitterId: "", group: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {publicRoleOptions.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsDepartment && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <p className="text-xs text-muted-foreground">
                    {isSubmitterRole(formData.role)
                      ? rosterValidationEnabledClient()
                        ? "Select your department first — your full name and Student ID must match the school's official class list (e.g. ICT and Information Technology count as the same department)."
                        : "Select your department first — your Student ID prefix must match this department."
                      : "Select the department you belong to."}
                  </p>
                  <Select
                    value={formData.group}
                    onValueChange={(value) => {
                      setFormData((prev) => ({
                        ...prev,
                        group: value,
                        ...(isSubmitterRole(prev.role) ? { submitterId: "" } : {}),
                      }))
                      if (errors.group) setErrors({ ...errors, group: undefined })
                      if (errors.submitterId) setErrors({ ...errors, submitterId: undefined })
                    }}
                  >
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Select department / programme" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGroups.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {groupMessage && (
                    <p className="text-sm text-destructive">{groupMessage}</p>
                  )}
                </div>
              )}

              {isSubmitterRole(formData.role) && (
                <div className="space-y-2">
                  <Label htmlFor="submitterId">Student ID *</Label>
                  <Input
                    id="submitterId"
                    type="text"
                    placeholder="e.g. BIT0001526"
                    value={formData.submitterId || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, submitterId: e.target.value })
                      if (errors.submitterId) setErrors({ ...errors, submitterId: undefined })
                    }}
                    required
                    aria-invalid={!!submitterIdMessage}
                    aria-describedby={submitterIdMessage ? "submitterId-hint" : undefined}
                    className={submitterIdMessage ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                  {submitterIdMessage && (
                    <p id="submitterId-hint" className="text-sm text-destructive" role="alert">
                      {submitterIdMessage}
                    </p>
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
                  minLength={8}
                  autoComplete="new-password"
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
                <PasswordStrengthMeter password={formData.password} />
                <p className="text-xs text-muted-foreground">{REGISTRATION_PASSWORD_HINT}</p>
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

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || studentBlockingIssue}
              >
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

