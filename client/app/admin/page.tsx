"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getPetitionsByRole, updatePetitionStatus, type Petition } from "@/lib/petition-store"
import type { PetitionStatus, PetitionType } from "@/lib/types"
import { DashboardHeader } from "@/components/dashboard-header"
import { AdminPetitionCard } from "@/components/admin-petition-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, FileText, Clock, CheckCircle, AlertTriangle, Users, Shield, Loader2 } from "lucide-react"

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<PetitionStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<PetitionType | "all">("all")
  const [activeTab, setActiveTab] = useState("all")
  const [allPetitions, setAllPetitions] = useState<Petition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingPetitionId, setUpdatingPetitionId] = useState<string | null>(null)

  // Fetch petitions based on user role
  useEffect(() => {
    const fetchPetitions = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const petitions = await getPetitionsByRole(user.role, user.email, user.department)
        setAllPetitions(petitions)
      } catch (error) {
        console.error("Error fetching petitions:", error)
        setAllPetitions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchPetitions()
  }, [user])

  const filteredPetitions = useMemo(() => {
    if (!user) return []

    let filtered = allPetitions

    // Tabs filter
    if (activeTab !== "all") {
      filtered = filtered.filter((petition) => {
        switch (activeTab) {
          case "pending":
            return !["resolved", "rejected"].includes(petition.status)
          case "urgent":
            return petition.priority === "urgent"
          case "assigned":
            return petition.assignedTo === user.email
          default:
            return true
        }
      })
    }

    // Search + status/type filter
    return filtered.filter((petition) => {
      const matchesSearch =
        petition.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        petition.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        petition.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        petition.id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === "all" || petition.status === statusFilter
      const matchesType = typeFilter === "all" || petition.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [allPetitions, searchQuery, statusFilter, typeFilter, activeTab, user])

  const stats = useMemo(() => {
    if (!user) return { total: 0, pending: 0, resolved: 0, urgent: 0, assigned: 0 }

    const total = allPetitions.length
    const pending = allPetitions.filter((p) => !["resolved", "rejected"].includes(p.status)).length
    const resolved = allPetitions.filter((p) => p.status === "resolved").length
    const urgent = allPetitions.filter((p) => p.priority === "urgent").length
    const assigned = allPetitions.filter((p) => p.assignedTo === user.email).length

    return { total, pending, resolved, urgent, assigned }
  }, [allPetitions, user])

  const handleStatusUpdate = async (petitionId: string, newStatus: string) => {
    if (!user) return
    
    setUpdatingPetitionId(petitionId)
    try {
      const success = await updatePetitionStatus(petitionId as string, newStatus as PetitionStatus)
      if (success) {
        // Refresh petitions after status update
        const petitions = await getPetitionsByRole(user.role, user.email, user.department)
        setAllPetitions(petitions)
      }
    } catch (error) {
      console.error("Error updating petition status:", error)
    } finally {
      setUpdatingPetitionId(null)
    }
  }

  const getRoleTitle = () => {
    switch (user?.role) {
      case "class_advisor":
        return "Class Advisor Dashboard"
      case "hod":
        return "Head of Department Dashboard"
      case "registrar":
        return "Registrar Dashboard"
      default:
        return "Administrative Dashboard"
    }
  }

  const getRoleDescription = () => {
    switch (user?.role) {
      case "class_advisor":
        return "Review and manage petitions from your department students"
      case "hod":
        return "Handle escalated petitions and departmental issues"
      case "registrar":
        return "Manage university-level administrative petitions"
      default:
        return "Administrative petition management"
    }
  }

  // Show loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading petitions...</p>
        </div>
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

  // Render access denied if user is student
  if (user.role === "student") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">{getRoleTitle()}</h2>
          <p className="text-muted-foreground">{getRoleDescription()}</p>
          {user.department && (
            <Badge variant="outline" className="mt-2">
              {user.department} Department
            </Badge>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Petitions</CardTitle>
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
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All Petitions</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="urgent">Urgent</TabsTrigger>
              <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
            </TabsList>

            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search petitions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value: PetitionStatus | "all") => setStatusFilter(value)}>
                <SelectTrigger className="w-[140px]">
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

              <Select value={typeFilter} onValueChange={(value: PetitionType | "all") => setTypeFilter(value)}>
                <SelectTrigger className="w-[140px]">
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

          <TabsContent value={activeTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {activeTab === "all" && "All Petitions"}
                {activeTab === "pending" && "Pending Petitions"}
                {activeTab === "urgent" && "Urgent Petitions"}
                {activeTab === "assigned" && "Assigned to Me"}
              </h3>
              <Badge variant="secondary">{filteredPetitions.length} found</Badge>
            </div>

            {filteredPetitions.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No petitions found</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                        ? "Try adjusting your search or filters"
                        : "No petitions match the current criteria"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPetitions.map((petition) => (
                  <AdminPetitionCard
                    key={petition.id}
                    petition={petition}
                    userRole={user.role}
                    onStatusUpdate={handleStatusUpdate}
                    isUpdating={updatingPetitionId === petition.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )

}

