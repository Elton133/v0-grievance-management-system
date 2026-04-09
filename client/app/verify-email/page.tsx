"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import Image from "next/image"
import { authApi } from "@/lib/api"

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [resendEmail, setResendEmail] = useState("")
  const [isResending, setIsResending] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  useEffect(() => {
    const emailParam = searchParams.get("email")
    if (emailParam) setResendEmail(decodeURIComponent(emailParam))
  }, [searchParams])

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("error")
        return
      }

      try {
        await authApi.verifyEmail(token)
        setStatus("success")
        toast.success("Email verified successfully!")
        setTimeout(() => {
          router.push("/login")
        }, 3000)
      } catch (error) {
        setStatus("error")
        const msg = error instanceof Error ? error.message : "Failed to verify email"
        toast.error(msg)
      }
    }

    verify()
  }, [token, router])

  const handleResend = async () => {
    const email = resendEmail.trim().toLowerCase()
    if (!email) {
      toast.error("Enter the email address you used to register.")
      return
    }

    setIsResending(true)
    try {
      const data = await authApi.resendVerification(email)
      toast.success(data.msg || "Verification email sent. Check your inbox.")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not send verification email."
      toast.error(msg)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="School Logo" width={120} height={120} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Email Verification</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {status === "verifying" && <Loader2 className="h-5 w-5 animate-spin" />}
              {status === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {status === "error" && <XCircle className="h-5 w-5 text-destructive" />}
              {status === "verifying" && "Verifying Email"}
              {status === "success" && "Email Verified"}
              {status === "error" && "Verification Failed"}
            </CardTitle>
            <CardDescription>
              {status === "verifying" && "Please wait while we verify your email address..."}
              {status === "success" && "Your email has been successfully verified."}
              {status === "error" && "The verification link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "verifying" && (
              <div className="text-center py-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Verifying your email...</p>
              </div>
            )}

            {status === "success" && (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your email address has been verified. You can now log in to your account. Redirecting to login
                    page...
                  </AlertDescription>
                </Alert>
                <Button asChild className="w-full">
                  <Link href="/login">Go to Login</Link>
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {!token
                      ? "Open the verification link from your email, or enter your address below to receive a new link."
                      : "The verification link is invalid or has expired. Enter your email below to receive a new link."}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="resend-email">Registered email</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@school.edu"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    disabled={isResending}
                  />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={handleResend}
                  disabled={isResending || !resendEmail.trim()}
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send new verification link
                    </>
                  )}
                </Button>

                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">Back to login</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
