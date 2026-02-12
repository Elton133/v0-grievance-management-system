"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import Image from "next/image"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus("error")
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (response.ok) {
          setStatus("success")
          toast.success("Email verified successfully!")
          setTimeout(() => {
            router.push("/login")
          }, 3000)
        } else {
          setStatus("error")
          toast.error(data.msg || "Failed to verify email")
        }
      } catch (error) {
        console.error("Error verifying email:", error)
        setStatus("error")
        toast.error("An error occurred. Please try again.")
      }
    }

    verifyEmail()
  }, [token, router])

  const handleResend = async () => {
    // This would need the user's email - for now, redirect to login
    toast.info("Please log in to resend verification email")
    router.push("/login")
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
                    Your email address has been verified. You can now log in to your account.
                    Redirecting to login page...
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
                      ? "No verification token provided."
                      : "The verification link is invalid or has expired. Please request a new verification email."}
                  </AlertDescription>
                </Alert>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleResend} className="flex-1">
                    <Mail className="mr-2 h-4 w-4" />
                    Resend Email
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/login">Go to Login</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

