"use client"

import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
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
import { LogOut, User } from "lucide-react"

export function DashboardHeader() {
  const { user, logout } = useAuth()
  const { settings, getRoleLabel } = useSettings()

  if (!user) return null

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">

        {/* Center — page context (hidden on mobile to save space) */}
        <div className="hidden sm:block">
          <p className="text-sm text-muted-foreground">
            Welcome, <span className="font-medium text-foreground">{user.name}</span>
          </p>
        </div>

        {/* Right side — notifications + user menu */}
        <div className="flex items-center gap-2 ml-auto">
          <NotificationBell />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative h-9 w-9 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="User menu"
              >
                <Avatar className="h-9 w-9 cursor-pointer">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {getRoleLabel(user.role)}
                  </p>
                  {user.submitterId && (
                    <p className="text-xs leading-none text-muted-foreground">ID: {user.submitterId}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
