"use client"

import { useState, useMemo, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { getPetitionsByStudent, getPetitions, type Petition } from "@/lib/petition-store"
import type { PetitionStatus, PetitionType } from "@/lib/types"
import { DashboardHeader } from "@/components/dashboard-header"
import { PetitionCard } from "@/components/petition-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, FileText, Clock, CheckCircle, AlertTriangle, Settings, Loader2 } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<PetitionStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<PetitionType | "all">("all")
  const [allPetitions, setAllPetitions] = useState<Petition[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch petitions based on user role
  useEffect(() => {
    const fetchPetitions = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        let petitions: Petition[] = []
        if (user.role === "student") {
          petitions = await getPetitionsByStudent(user.studentId!)
        } else {
          petitions = await getPetitions()
        }
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

  // Filter petitions
  const filteredPetitions = useMemo(() => {
    return allPetitions.filter((petition) => {
      const matchesSearch =
        petition.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        petition.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        petition.id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === "all" || petition.status === statusFilter
      const matchesType = typeFilter === "all" || petition.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [allPetitions, searchQuery, statusFilter, typeFilter])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = allPetitions.length
    const pending = allPetitions.filter((p) => !["resolved", "rejected"].includes(p.status)).length
    const resolved = allPetitions.filter((p) => p.status === "resolved").length
    const urgent = allPetitions.filter((p) => p.priority === "urgent").length

    return { total, pending, resolved, urgent }
  }, [allPetitions])

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading petitions...</p>
        </div>
      </div>
    )
  }

  if (user.role !== "student") {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Administrative Access
              </CardTitle>
              <CardDescription>
                You have administrative privileges. Access the admin portal to manage petitions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin">Go to Admin Portal</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Welcome back, {user.name.split(" ")[0]}!</h2>
          <p className="text-muted-foreground">
            {user.role === "student"
              ? "Track your petitions and submit new grievances"
              : "Manage and review student petitions"}
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Petitions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {user.role === "student" ? "Submitted by you" : "All submissions"}
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
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search petitions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2">
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

            {user.role === "student" && (
              <Button asChild>
                <Link href="/petition/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Petition
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Petitions List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {user.role === "student" ? "Your Petitions" : "All Petitions"}
            </h3>
            <Badge variant="secondary">{filteredPetitions.length} found</Badge>
          </div>

          {filteredPetitions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No petitions found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : user.role === "student"
                        ? "You haven't submitted any petitions yet"
                        : "No petitions have been submitted"}
                  </p>
                  {user.role === "student" && (
                    <Button asChild>
                      <Link href="/petition/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Submit Your First Petition
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPetitions.map((petition) => (
                <PetitionCard key={petition.id} petition={petition} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
