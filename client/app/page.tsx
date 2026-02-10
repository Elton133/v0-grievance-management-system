"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { AppLoader } from "@/components/ui/app-loader"

export default function HomePage() {
  const { isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      // Always start at the login page when the app loads
      router.replace("/login")
    }
  }, [isLoading, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AppLoader message="Preparing your experience..." />
    </div>
  )
}
