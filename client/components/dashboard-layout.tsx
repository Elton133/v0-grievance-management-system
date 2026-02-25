"use client"

import type React from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth()

  if (!user) return <>{children}</>

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      
      {/* Main content area — offset by sidebar width on desktop */}
      <div className="lg:pl-64 transition-all duration-300">
        <DashboardHeader />
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
