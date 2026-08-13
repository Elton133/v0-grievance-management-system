"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { getRawTickets, computeAnalytics, getAuditLogs } from "@/lib/analytics-store"
import type { Ticket } from "@/lib/types"
import { AnalyticsCharts } from "@/components/analytics-charts"
import { AuditLogTable } from "@/components/audit-log-table"
import { AppLoader } from "@/components/ui/app-loader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, BarChart3, Activity, Download } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSettings } from "@/lib/settings-context"
import { downloadAnalyticsReport } from "@/lib/export-analytics"
import { toast } from "sonner"

export default function AnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { isSubmitterRole, settings, getStatusLabel, getTicketTypeLabel } = useSettings()
  const router = useRouter()
  const [allTickets, setAllTickets] = useState<Ticket[]>([])
  const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof getAuditLogs>>>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  const [filterDept, setFilterDept] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login")
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user || isSubmitterRole(user.role)) return
    const fetchAnalytics = async () => {
      try {
        const [tickets, logs] = await Promise.all([getRawTickets(), getAuditLogs(100)])
        setAllTickets(tickets)
        setAuditLogs(logs)
      } catch (error) {
        console.error("Error fetching analytics data:", error)
      } finally {
        setIsLoadingData(false)
      }
    }
    void fetchAnalytics()
  }, [user, isSubmitterRole])

  const departments = useMemo(() => [...new Set(allTickets.map((t) => t.group))].sort(), [allTickets])
  const types = useMemo(() => [...new Set(allTickets.map((t) => t.type))].sort(), [allTickets])
  const statuses = useMemo(() => [...new Set(allTickets.map((t) => t.status))].sort(), [allTickets])

  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      if (filterDept !== "all" && t.group !== filterDept) return false
      if (filterType !== "all" && t.type !== filterType) return false
      if (filterStatus !== "all" && t.status !== filterStatus) return false
      return true
    })
  }, [allTickets, filterDept, filterType, filterStatus])

  const analyticsData = useMemo(() => computeAnalytics(filteredTickets), [filteredTickets])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AppLoader message={authLoading ? "Loading..." : "Redirecting to sign in..."} />
      </div>
    )
  }

  if (isSubmitterRole(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>Access denied. Administrative privileges required to view analytics.</AlertDescription>
            </Alert>
            <Button onClick={() => router.push("/dashboard")} className="w-full mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AppLoader message="Loading analytics..." />
      </div>
    )
  }

  const handleExportData = () => {
    try {
      downloadAnalyticsReport(analyticsData, auditLogs, {
        organizationName: settings.organizationName,
        statusLabel: getStatusLabel,
        typeLabel: getTicketTypeLabel,
      })
      toast.success("Report downloaded")
    } catch (err) {
      console.error(err)
      toast.error("Could not export report")
    }
  }

  const activeFilters = [filterDept, filterType, filterStatus].filter((f) => f !== "all").length

  return (
    <div className="min-h-screen bg-background">

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Analytics & Reports</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Comprehensive insights into petition management and system performance
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportData} className="text-xs sm:text-sm flex-shrink-0">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterDept("all"); setFilterType("all"); setFilterStatus("all") }}>
              Clear filters ({activeFilters})
            </Button>
          )}

          <span className="text-sm text-muted-foreground ml-auto">
            {filteredTickets.length} of {allTickets.length} petitions
          </span>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Activity className="mr-2 h-4 w-4" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="max-w-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Petitions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.totalTickets}</div>
                <p className="text-xs text-muted-foreground">
                  {activeFilters > 0 ? `Filtered from ${allTickets.length} total` : "All submissions"}
                </p>
              </CardContent>
            </Card>

            {/* Charts */}
            <AnalyticsCharts data={analyticsData} />

            <Card>
              <CardHeader>
                <CardTitle>Petitions by department</CardTitle>
                <CardDescription>Volume of submissions per department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analyticsData.ticketsByGroup).map(([dept, countVal]) => {
                    const count = countVal as number
                    return (
                      <div key={dept} className="flex items-center justify-between p-4 border rounded-lg">
                        <h4 className="font-medium">{dept}</h4>
                        <span className="text-2xl font-bold">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <AuditLogTable
              logs={auditLogs}
              title="System Audit Log"
              description="Complete record of all system activities and changes"
              showFilters
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
