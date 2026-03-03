"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { getAnalyticsData, getAuditLogs } from "@/lib/analytics-store"
import { AnalyticsCharts } from "@/components/analytics-charts"
import { AuditLogTable } from "@/components/audit-log-table"
import { AppLoader } from "@/components/ui/app-loader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Shield, BarChart3, Activity, Download, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // Only allow admin users to access analytics
  if (!user || user.role === "submitter") {
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

  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const auditLogs = getAuditLogs(50) // Get last 50 audit logs

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await getAnalyticsData()
        setAnalyticsData(data)
      } catch (error) {
        console.error("Error fetching analytics data:", error)
      } finally {
        setIsLoadingData(false)
      }
    }
    fetchAnalytics()
  }, [])

  // Show loading state
  if (isLoading || isLoadingData || !analyticsData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AppLoader message="Loading analytics..." />
      </div>
    )
  }

  const handleExportData = () => {
    // In a real app, this would generate and download a report
    alert("Export functionality would be implemented here")
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Analytics & Reports</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Comprehensive insights into ticket management and system performance
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleExportData} className="text-xs sm:text-sm">
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Export Report</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm">
              <Calendar className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Date Range</span>
              <span className="sm:hidden">Date</span>
            </Button>
          </div>
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
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.totalTickets}</div>
                  <p className="text-xs text-muted-foreground">All time submissions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsData.totalTickets > 0
                      ? Math.round(
                          ((analyticsData.ticketsByStatus.resolved || 0) / analyticsData.totalTickets) * 100,
                        )
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground">Successfully resolved</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.responseTimeMetrics.averageResponseTime}</div>
                  <p className="text-xs text-muted-foreground">Days to first response</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Escalation Rate</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(analyticsData.responseTimeMetrics.escalationRate * 100)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Require escalation</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <AnalyticsCharts data={analyticsData} />

            {/* Group Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Group Performance</CardTitle>
                <CardDescription>Ticket volume and resolution metrics by group</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analyticsData.ticketsByGroup).map(([dept, countVal]) => {
                    const count = countVal as number
                    const resolvedCount = Math.floor(count * 0.7) // Mock resolved count
                    const resolutionRate = Math.round((resolvedCount / count) * 100)

                    return (
                      <div key={dept} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{dept}</h4>
                          <p className="text-sm text-muted-foreground">
                            {count} tickets • {resolvedCount} resolved
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{resolutionRate}%</div>
                          <p className="text-xs text-muted-foreground">Resolution rate</p>
                        </div>
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
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
