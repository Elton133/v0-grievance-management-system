"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { getNotificationsByUser, getUnreadCount, markNotificationAsRead, markAllAsRead } from "@/lib/notification-store"
import type { Notification } from "@/lib/notification-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, CheckCheck, MessageSquare, ArrowUp, CheckCircle } from "lucide-react"
import Link from "next/link"

const notificationIcons = {
  status_update: CheckCircle,
  comment: MessageSquare,
  escalation: ArrowUp,
  resolution: CheckCircle,
}

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (user) {
      const userNotifications = getNotificationsByUser(user.email)
      const unread = getUnreadCount(user.email)
      setNotifications(userNotifications)
      setUnreadCount(unread)
    }
  }, [user])

  const handleMarkAsRead = (notificationId: string) => {
    markNotificationAsRead(notificationId)
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAllAsRead = () => {
    if (user) {
      markAllAsRead(user.email)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    }
  }

  if (!user) return null

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="h-80">
            {notifications.slice(0, 10).map((notification) => {
              const IconComponent = notificationIcons[notification.type]
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className="p-0"
                  onSelect={() => handleMarkAsRead(notification.id)}
                >
                  <Link
                    href={`/ticket/${notification.ticketId}`}
                    className="flex items-start gap-3 p-3 w-full hover:bg-muted/50 transition-colors"
                  >
                    <div className={`rounded-full p-1 ${notification.isRead ? "bg-muted" : "bg-primary/10"}`}>
                      <IconComponent
                        className={`h-4 w-4 ${notification.isRead ? "text-muted-foreground" : "text-primary"}`}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-medium ${notification.isRead ? "text-muted-foreground" : "text-foreground"}`}
                        >
                          {notification.title}
                        </p>
                        {!notification.isRead && <div className="w-2 h-2 bg-primary rounded-full" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.createdAt.toLocaleDateString()} at{" "}
                        {notification.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </ScrollArea>
        )}

        {notifications.length > 10 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="text-center text-sm text-primary">
                View all notifications
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
