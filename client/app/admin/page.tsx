"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { toast } from "sonner"
import { getTicketsByRole, updateTicketStatus, type Ticket } from "@/lib/ticket-store"
import type { TicketStatus, TicketType } from "@/lib/types"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AdminTicketCard } from "@/components/admin-ticket-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, FileText, Clock, CheckCircle, AlertTriangle, Users, Shield } from "lucide-react"
import { AppLoader } from "@/components/ui/app-loader"
import { Pagination } from "@/components/ui/pagination"

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { isSubmitterRole, getRoleLabel } = useSettings()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<TicketType | "all">("all")
  const [activeTab, setActiveTab] = useState("all")
  const [allTickets, setAllTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Fetch tickets based on user role
  useEffect(() => {
    const fetchTickets = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const tickets = await getTicketsByRole(user.role, user.email, user.group)
        setAllTickets(tickets)
      } catch (error) {
        console.error("Error fetching tickets:", error)
        setAllTickets([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchTickets()
  }, [user])

  const filteredTickets = useMemo(() => {
    if (!user) return []

    let filtered = allTickets

    // Tabs filter
    if (activeTab !== "all") {
      filtered = filtered.filter((ticket) => {
        switch (activeTab) {
          case "pending":
            return !["resolved", "rejected"].includes(ticket.status)
          case "urgent":
            return ticket.priority === "urgent"
          case "assigned":
            return ticket.assignedTo === user.email
          default:
            return true
        }
      })
    }

    // Search + status/type filter
    return filtered.filter((ticket) => {
      const matchesSearch =
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.submitterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
      const matchesType = typeFilter === "all" || ticket.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [allTickets, searchQuery, statusFilter, typeFilter, activeTab, user])

  // Paginate filtered results
  const paginatedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredTickets.slice(startIndex, endIndex)
  }, [filteredTickets, currentPage, itemsPerPage])

  const filteredPagination = useMemo(() => {
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage)
    return {
      page: currentPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    }
  }, [filteredTickets.length, currentPage, itemsPerPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, typeFilter, activeTab])

  const stats = useMemo(() => {
    if (!user) return { total: 0, pending: 0, resolved: 0, urgent: 0, assigned: 0 }

    const total = allTickets.length
    const pending = allTickets.filter((p) => !["resolved", "rejected"].includes(p.status)).length
    const resolved = allTickets.filter((p) => p.status === "resolved").length
    const urgent = allTickets.filter((p) => p.priority === "urgent").length
    const assigned = allTickets.filter((p) => p.assignedTo === user.email).length

    return { total, pending, resolved, urgent, assigned }
  }, [allTickets, user])

  const handleStatusUpdate = async (ticketId: string, newStatus: string) => {
    if (!user) return
    
    setUpdatingTicketId(ticketId)
    try {
      const success = await updateTicketStatus(ticketId as string, newStatus as TicketStatus)
      if (success) {
        toast.success("Status updated successfully!", {
          description: `Ticket status changed to ${newStatus.replace(/_/g, " ")}`,
        })
        // Refresh tickets after status update
        const tickets = await getTicketsByRole(user.role, user.email, user.group)
        setAllTickets(tickets)
      } else {
        toast.error("Failed to update status", {
          description: "Please try again.",
        })
      }
    } catch (error) {
      console.error("Error updating ticket status:", error)
      toast.error("Failed to update status", {
        description: error instanceof Error ? error.message : "An error occurred",
      })
    } finally {
      setUpdatingTicketId(null)
    }
  }

  const getRoleTitle = () => {
    if (!user) return "Administrative Dashboard"
    return `${getRoleLabel(user.role)} Dashboard`
  }

  const getRoleDescription = () => {
    switch (user?.role) {
      case "class_advisor":
        return "Review and manage tickets from your group submitters"
      case "hod":
        return "Handle escalated tickets and groupal issues"
      case "registrar":
        return "Manage university-level administrative tickets"
      default:
        return "Administrative ticket management"
    }
  }

  // Show loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AppLoader message="Loading tickets..." />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access this page.</p>
        </div>
      </div>
    )
  }

  if (user.role === "submitter" || isSubmitterRole(user.role)) {
    return (
      <DashboardLayout>
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>Access denied. Administrative privileges required.</AlertDescription>
            </Alert>
            <Button onClick={() => router.push("/dashboard")} className="w-full mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Welcome Section */}
      <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{getRoleTitle()}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">{getRoleDescription()}</p>
          {user.group && (
            <Badge variant="outline" className="mt-2">
              {user.group} Group
            </Badge>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">In your queue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgent</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.urgent}</div>
              <p className="text-xs text-muted-foreground">High priority</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned to Me</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.assigned}</div>
              <p className="text-xs text-muted-foreground">Your responsibility</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Filters */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col gap-4">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm">All Tickets</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs sm:text-sm">Pending</TabsTrigger>
              <TabsTrigger value="urgent" className="text-xs sm:text-sm">Urgent</TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs sm:text-sm">Assigned to Me</TabsTrigger>
            </TabsList>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(value: TicketStatus | "all") => setStatusFilter(value)}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="forwarded_to_hod">Forwarded to HOD</SelectItem>
                    <SelectItem value="forwarded_to_registrar">Forwarded to Registrar</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={(value: TicketType | "all") => setTypeFilter(value)}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="academic_issue">Academic</SelectItem>
                    <SelectItem value="administrative_issue">Administrative</SelectItem>
                    <SelectItem value="facility_issue">Facility</SelectItem>
                    <SelectItem value="disciplinary_issue">Disciplinary</SelectItem>
                    <SelectItem value="financial_issue">Financial</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <TabsContent value={activeTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {activeTab === "all" && "All Tickets"}
                {activeTab === "pending" && "Pending Tickets"}
                {activeTab === "urgent" && "Urgent Tickets"}
                {activeTab === "assigned" && "Assigned to Me"}
              </h3>
              <Badge variant="secondary">{filteredTickets.length} found</Badge>
            </div>

            {filteredTickets.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No tickets found</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                        ? "Try adjusting your search or filters"
                        : "No tickets match the current criteria"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {paginatedTickets.map((ticket) => (
                    <AdminTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      userRole={user.role}
                      onStatusUpdate={handleStatusUpdate}
                      isUpdating={updatingTicketId === ticket.id}
                    />
                  ))}
                </div>
                {filteredPagination.totalPages > 1 && (
                  <Pagination
                    page={filteredPagination.page}
                    totalPages={filteredPagination.totalPages}
                    onPageChange={setCurrentPage}
                    hasNext={filteredPagination.hasNext}
                    hasPrev={filteredPagination.hasPrev}
                  />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
    </DashboardLayout>
  )

}

