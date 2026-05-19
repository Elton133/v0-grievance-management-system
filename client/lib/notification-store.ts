"use client"

export interface Notification {
  id: string
  userId: string
  ticketId: string
  title: string
  message: string
  type: "status_update" | "comment" | "escalation" | "resolution"
  isRead: boolean
  createdAt: Date
}

// Mock notification store
const notifications: Notification[] = [
  {
    id: "NOTIF-001",
    userId: "ST2024001",
    ticketId: "PET-2024-001",
    title: "Ticket Under Review",
    message: "Your ticket 'Grade Discrepancy in Data Structures Course' is now under review by the class advisor.",
    type: "status_update",
    isRead: false,
    createdAt: new Date("2024-01-16T10:30:00"),
  },
  {
    id: "NOTIF-002",
    userId: "advisor@university.edu",
    ticketId: "PET-2024-002",
    title: "New Ticket Assigned",
    message: "A new ticket 'Library Computer Lab Issues' has been assigned to you for review.",
    type: "escalation",
    isRead: false,
    createdAt: new Date("2024-01-12T14:15:00"),
  },
]

export function getNotificationsByUser(userId: string): Notification[] {
  return notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function getUnreadCount(userId: string): number {
  return notifications.filter((n) => n.userId === userId && !n.isRead).length
}

export function markNotificationAsRead(notificationId: string): boolean {
  const notification = notifications.find((n) => n.id === notificationId)
  if (notification) {
    notification.isRead = true
    return true
  }
  return false
}

export function markAllAsRead(userId: string): void {
  notifications.forEach((n) => {
    if (n.userId === userId) {
      n.isRead = true
    }
  })
}

export function addNotification(notification: Omit<Notification, "id" | "createdAt">): Notification {
  const newNotification: Notification = {
    ...notification,
    id: `NOTIF-${Date.now()}`,
    createdAt: new Date(),
  }
  notifications.push(newNotification)
  return newNotification
}

// Helper function to create status update notifications
export function createStatusUpdateNotification(
  ticketId: string,
  submitterId: string,
  newStatus: string,
  ticketSubject: string,
): void {
  const statusMessages = {
    under_review: "is now under review by the class advisor",
    forwarded_to_hod: "has been forwarded to the Registrar",
    forwarded_to_registrar: "has been forwarded to the Registrar",
    resolved: "has been resolved",
    rejected: "has been rejected",
  }

  const message = statusMessages[newStatus as keyof typeof statusMessages] || "status has been updated"

  addNotification({
    userId: submitterId,
    ticketId,
    title: "Ticket Status Update",
    message: `Your ticket '${ticketSubject}' ${message}.`,
    type: "status_update",
    isRead: false,
  })
}
