"use client"

import { useState, useMemo, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { getTicketsBySubmitter, getTickets, type Ticket } from "@/lib/ticket-store"
import type { TicketStatus, TicketType } from "@/lib/types"
import { TicketCard } from "@/components/ticket-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, FileText, Clock, CheckCircle, AlertTriangle, Settings } from "lucide-react"
import { AppLoader } from "@/components/ui/app-loader"
import { Pagination } from "@/components/ui/pagination"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { settings, isSubmitterRole, getRoleLabel } = useSettings()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<TicketType | "all">("all")
  const [allTickets, setAllTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  })
  const itemsPerPage = 12

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login")
    }
  }, [authLoading, user, router])

  // Fetch tickets based on user role
  useEffect(() => {
    const fetchTickets = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        // Fetch all tickets (we'll paginate client-side after filtering)
        // For better performance, you can implement server-side filtering later
        let result: { data: Ticket[]; pagination: any }
        if (user.role === "submitter") {
          result = await getTicketsBySubmitter(user.submitterId!, 1, 1000) // Fetch all for now
        } else {
          result = await getTickets(1, 1000) // Fetch all for now
        }
        setAllTickets(result.data)
      } catch (error) {
        console.error("Error fetching tickets:", error)
        setAllTickets([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchTickets()
  }, [user])

  // Filter tickets (client-side filtering for now)
  const filteredTickets = useMemo(() => {
    return allTickets.filter((ticket) => {
      const matchesSearch =
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
      const matchesType = typeFilter === "all" || ticket.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [allTickets, searchQuery, statusFilter, typeFilter])

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
  }, [searchQuery, statusFilter, typeFilter])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = allTickets.length
    const pending = allTickets.filter((p) => !["resolved", "rejected"].includes(p.status)).length
    const resolved = allTickets.filter((p) => p.status === "resolved").length
    const urgent = allTickets.filter((p) => p.priority === "urgent").length

    return { total, pending, resolved, urgent }
  }, [allTickets])

  if (authLoading || isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AppLoader message="Loading tickets..." />
      </div>
    )
  }

  if (user.role !== "submitter" && !isSubmitterRole(user.role)) {
    return (
      <>
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Administrative Access
            </CardTitle>
            <CardDescription>
              You have administrative privileges. Access the admin portal to manage tickets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin">Go to Admin Portal</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {/* Welcome Section */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Welcome back, {user.name.split(" ")[0]}!</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          {isSubmitterRole(user.role)
            ? "Track your tickets and submit new grievances"
            : "Manage and review submitter tickets"}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {isSubmitterRole(user.role) ? "Submitted by you" : "All submissions"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urgent}</div>
            <p className="text-xs text-muted-foreground">High priority items</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions and Filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={(value: TicketStatus | "all") => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {settings.statusLabelsConfig.map((status) => (
                  <SelectItem key={status.key} value={status.key}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(value: TicketType | "all") => setTypeFilter(value)}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {settings.ticketTypesConfig.map((type) => (
                  <SelectItem key={type.key} value={type.key}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isSubmitterRole(user.role) && (
              <Button asChild className="w-full sm:w-auto">
                <Link href="/ticket/new">
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">New Ticket</span>
                  <span className="sm:hidden">New</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {isSubmitterRole(user.role) ? "Your Tickets" : "All Tickets"}
          </h3>
          <Badge variant="secondary">{filteredTickets.length} found</Badge>
        </div>

        {filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No tickets found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : isSubmitterRole(user.role)
                      ? "You haven't submitted any tickets yet"
                      : "No tickets have been submitted"}
                </p>
                {isSubmitterRole(user.role) && (
                  <Button asChild>
                    <Link href="/ticket/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Submit Your First Ticket
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {paginatedTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
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
      </div>
    </>
  )
}
