"use client"

import { useAuth } from "@/lib/auth-context"
import { NotificationBell } from "@/components/notification-bell"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GraduationCap, LogOut, User, BarChart3 } from "lucide-react"
import Link from "next/link"

export function DashboardHeader() {
  const { user, logout } = useAuth()

  if (!user) return null

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-lg p-2">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Student Grievance Portal</h1>
              <p className="text-sm text-muted-foreground">
                {user.role === "student" ? "Student Dashboard" : "Administrative Dashboard"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />

            {user.role !== "student" && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/analytics">
                  <BarChart3 className="h-4 w-4" />
                </Link>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    {user.studentId && (
                      <p className="text-xs leading-none text-muted-foreground">ID: {user.studentId}</p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {user.role !== "student" && (
                  <DropdownMenuItem asChild>
                    <Link href="/analytics">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      <span>Analytics</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
