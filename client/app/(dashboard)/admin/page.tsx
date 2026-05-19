"use client"

import type React from "react"
import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { getTicketsByRole, type Ticket } from "@/lib/ticket-store"
import type { TicketStatus } from "@/lib/types"
import { AdminTicketCard } from "@/components/admin-ticket-card"
import { AdminPetitionsTable } from "@/components/admin-petitions-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, FileText, Clock, CheckCircle, Users, Shield, Loader2 } from "lucide-react"
import { AppLoader } from "@/components/ui/app-loader"
import { Pagination } from "@/components/ui/pagination"
import { PETITION_TYPES } from "@/lib/petition-form-options"

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { settings, isLoading: settingsLoading, isSubmitterRole, getRoleLabel } = useSettings()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [allPetitions, setAllPetitions] = useState<Ticket[]>([])
  const [initialLoad, setInitialLoad] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login")
  }, [authLoading, user, router])

  const loadPetitions = useCallback(
    async (silent = false) => {
      if (!user || settingsLoading) {
        if (!user) setInitialLoad(false)
        return
      }
      if (!silent) setInitialLoad(true)
      else setIsRefreshing(true)
      try {
        const tickets = await getTicketsByRole(
          user.role,
          user.email,
          user.group,
          settings.rolesConfig,
          user.id
        )
        setAllPetitions(tickets)
      } catch (error) {
        console.error("Error fetching petitions:", error)
        setAllPetitions([])
      } finally {
        setInitialLoad(false)
        setIsRefreshing(false)
      }
    },
    [user, settings.rolesConfig, settingsLoading]
  )

  useEffect(() => {
    if (settingsLoading) return
    void loadPetitions(false)
    const id = window.setInterval(() => void loadPetitions(true), 60000)
    const onFocus = () => void loadPetitions(true)
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [loadPetitions, settingsLoading])

  const filteredPetitions = useMemo(() => {
    return allPetitions.filter((p) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        p.subject.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.submitterName.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || p.status === statusFilter
      const matchesType = typeFilter === "all" || p.type === typeFilter
      return matchesSearch && matchesStatus && matchesType
    })
  }, [allPetitions, searchQuery, statusFilter, typeFilter])

  const paginatedPetitions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredPetitions.slice(start, start + itemsPerPage)
  }, [filteredPetitions, currentPage])

  const totalPages = Math.ceil(filteredPetitions.length / itemsPerPage) || 1

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, typeFilter])

  const stats = useMemo(() => {
    const pending = allPetitions.filter((p) => !["resolved", "rejected"].includes(p.status)).length
    const resolved = allPetitions.filter((p) => p.status === "resolved").length
    return { total: allPetitions.length, pending, resolved, assigned: allPetitions.length }
  }, [allPetitions])

  const getRoleDescription = () => {
    switch (user?.role) {
      case "advisor":
      case "class_advisor":
        return "Review and manage petitions from students in your department"
      case "hod":
        return "Review petitions forwarded to you as Registrar"
      case "registrar":
        return "Final review — all resolutions and rejections end here"
      default:
        return "Manage student petitions"
    }
  }

  if (authLoading || settingsLoading || initialLoad) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <AppLoader message="Loading petitions..." />
      </div>
    )
  }

  if (!user) return null

  if (isSubmitterRole(user.role)) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>Access denied. Staff privileges required.</AlertDescription>
          </Alert>
          <Button onClick={() => router.push("/dashboard")} className="w-full mt-4">
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="mb-6 sm:mb-8 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{getRoleLabel(user.role)} Dashboard</h2>
          <p className="text-sm sm:text-base text-muted-foreground">{getRoleDescription()}</p>
          {user.group && user.role !== "registrar" && (
            <Badge variant="outline" className="mt-2">
              Department: {user.group}
            </Badge>
          )}
        </div>
        {isRefreshing && (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Refreshing
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="In your queue" value={stats.assigned} icon={<Users className="h-4 w-4" />} />
        <StatCard title="Pending" value={stats.pending} icon={<Clock className="h-4 w-4" />} />
        <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircle className="h-4 w-4" />} />
        <StatCard title="Total in queue" value={stats.total} icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your queue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TicketStatus | "all")}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under review</SelectItem>
              <SelectItem value="forwarded_to_hod">Forwarded to Registrar</SelectItem>
              <SelectItem value="forwarded_to_registrar">At Registrar</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {PETITION_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Your queue</h3>
          <Badge variant="secondary">{filteredPetitions.length} found</Badge>
        </div>

        {filteredPetitions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              No petitions in your queue match your filters.
            </CardContent>
          </Card>
        ) : (
          <>
            <AdminPetitionsTable petitions={paginatedPetitions} />
            <div className="grid gap-4 md:hidden">
              {paginatedPetitions.map((p) => (
                <AdminTicketCard key={p.id} ticket={p} userRole={user.role} />
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                hasNext={currentPage < totalPages}
                hasPrev={currentPage > 1}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

