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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  if (!user) return <>{children}</>

  return (
    <div className="min-h-screen bg-muted/20">
      <DashboardSidebar 
        isCollapsed={isSidebarCollapsed} 
        onCollapsedChange={setIsSidebarCollapsed} 
      />
      
      {/* Main content area — offset by sidebar width on desktop */}
      <div 
        className={cn(
          "transition-all duration-300",
          isSidebarCollapsed ? "lg:pl-[70px]" : "lg:pl-64"
        )}
      >
        <DashboardHeader />
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
