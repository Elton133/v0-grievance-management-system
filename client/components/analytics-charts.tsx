"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AnalyticsData } from "@/lib/analytics-store"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

interface AnalyticsChartsProps {
  data: AnalyticsData
}

const COLORS = {
  primary: "#059669",
  secondary: "#10b981",
  accent: "#f59e0b",
  destructive: "#dc2626",
  muted: "#6b7280",
}

const STATUS_COLORS = {
  submitted: COLORS.secondary,
  under_review: COLORS.accent,
  forwarded_to_hod: "#8b5cf6",
  forwarded_to_registrar: "#f97316",
  resolved: COLORS.primary,
  rejected: COLORS.destructive,
}

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  // Prepare data for charts
  const statusData = Object.entries(data.ticketsByStatus).map(([status, count]) => ({
    name: status.replace(/_/g, " ").toUpperCase(),
    value: count,
    color: STATUS_COLORS[status as keyof typeof STATUS_COLORS] || COLORS.muted,
  }))

  const typeData = Object.entries(data.ticketsByType).map(([type, count]) => ({
    name: type.replace(/_/g, " ").toUpperCase(),
    count,
  }))

  const priorityData = Object.entries(data.ticketsByPriority).map(([priority, count]) => ({
    name: priority.toUpperCase(),
    count,
  }))

  const groupData = Object.entries(data.ticketsByGroup).map(([dept, count]) => ({
    name: dept,
    count,
  }))

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Status Distribution */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Ticket Status Distribution</CardTitle>
          <CardDescription>Current status of all tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Key Metrics</CardTitle>
          <CardDescription>Performance indicators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Tickets</span>
            <Badge variant="secondary">{data.totalTickets}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Avg Resolution Time</span>
            <Badge variant="outline">{data.averageResolutionTime.toFixed(1)} days</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Response Time</span>
            <Badge variant="outline">{data.responseTimeMetrics.averageResponseTime} days</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Escalation Rate</span>
            <Badge variant="outline">{(data.responseTimeMetrics.escalationRate * 100).toFixed(0)}%</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Monthly Trends</CardTitle>
          <CardDescription>Ticket submissions and resolutions over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={COLORS.primary} name="Submitted" strokeWidth={2} />
              <Line type="monotone" dataKey="resolved" stroke={COLORS.secondary} name="Resolved" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ticket Types */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket Types</CardTitle>
          <CardDescription>Distribution by category</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Priority Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Priority Levels</CardTitle>
          <CardDescription>Ticket priority distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.accent} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Group Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>By Group</CardTitle>
          <CardDescription>Tickets per group</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={groupData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.secondary} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
