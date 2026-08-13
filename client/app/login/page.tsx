"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useSettings } from "@/lib/settings-context"
import { getStaffHomePath } from "@/lib/role-utils"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [showResendVerification, setShowResendVerification] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [success, setSuccess] = useState("")
  const { user, login, isLoading } = useAuth()
  const { settings, isSubmitterRole } = useSettings()
  const router = useRouter()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push(getStaffHomePath(user.role, isSubmitterRole))
    }
  }, [user, router, isSubmitterRole])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const emailParam = params.get("email")?.trim()
    if (emailParam && params.get("registered") !== "true") {
      setEmail(emailParam)
    }
  }, [router])

  // Check for registration success message
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("registered") === "true") {
        const registeredEmail = params.get("email")?.trim()
        if (registeredEmail) setEmail(registeredEmail)
        toast.success("Registration successful!", {
          description:
            "Open the verification link in your email (check spam). Use Resend verification below if needed.",
        })
        setSuccess(
          "Registration successful! Check your inbox and spam for the verification link, then log in."
        )
        setShowResendVerification(true)
        router.replace(registeredEmail ? `/login?email=${encodeURIComponent(registeredEmail)}` : "/login")
      }
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setShowResendVerification(false)

    const result = await login(email, password)
    if (result.success) {
      toast.success("Login successful!", {
        description: "Welcome back!",
      })
      // Redirect based on user role
      // Submitters go to /dashboard, admins go to /admin
      const storedUser = localStorage.getItem("grievance_user")
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser)
          router.push(getStaffHomePath(user.role, isSubmitterRole))
        } catch {
          router.push("/dashboard")
        }
      } else {
        router.push("/dashboard")
      }
    } else {
      const errorMsg = result.error || "Invalid email or password. Please try again."
      const isVerificationError = errorMsg.toLowerCase().includes("verify your email")
      setShowResendVerification(isVerificationError)
      toast.error("Login failed", {
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
            <img
              src={settings?.logoUrl || "/logo.png"}
              alt={settings?.organizationName || "School Logo"} 
              className="size-[120px] object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {settings?.organizationName ? `${settings.organizationName} Portal` : "Student Grievance Portal"}
          </h1>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access the grievance management system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
              </div>

              {success && (
                <Alert>
                  <AlertDescription className="text-green-600 dark:text-green-400">{success}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {error}
                    {showResendVerification && email && (
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto font-medium text-destructive underline ml-1"
                        disabled={resendingVerification}
                        onClick={async () => {
                          setResendingVerification(true)
                          try {
                            await authApi.resendVerification(email)
                            toast.success("Verification email sent", {
                              description: "Check your inbox and spam folder.",
                            })
                            setSuccess("Verification email sent! Check your inbox.")
                            setError("")
                            setShowResendVerification(false)
                          } catch (err) {
                            toast.error("Failed to resend", {
                              description: err instanceof Error ? err.message : "Please try again later.",
                            })
                          } finally {
                            setResendingVerification(false)
                          }
                        }}
                      >
                        {resendingVerification ? "Sending..." : "Resend verification email"}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm">
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Create one
                </Link>
              </p>
              <p className="text-muted-foreground">
                <Link href="/forgot-password" className="text-primary hover:underline font-medium">
                  Forgot your password?
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
