import type { AnalyticsData, AuditLog } from "./analytics-store"

function csvEscape(value: string | number): string {
  const s = String(value ?? "")
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function row(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(",")
}

export function downloadAnalyticsReport(
  data: AnalyticsData,
  auditLogs: AuditLog[],
  options: {
    organizationName?: string
    statusLabel?: (key: string) => string
    typeLabel?: (key: string) => string
  } = {}
): void {
  const statusLabel = options.statusLabel ?? ((k) => k)
  const typeLabel = options.typeLabel ?? ((k) => k)
  const lines: string[] = []
  const generated = new Date().toISOString()

  lines.push(row(["Petition analytics report"]))
  lines.push(row(["Organization", options.organizationName ?? ""]))
  lines.push(row(["Generated", generated]))
  lines.push("")

  lines.push(row(["Summary"]))
  lines.push(row(["Total petitions", data.totalTickets]))
  lines.push(row(["Average resolution (days)", data.averageResolutionTime.toFixed(1)]))
  lines.push(row(["Average first response (days)", data.responseTimeMetrics.averageResponseTime.toFixed(1)]))
  lines.push(row(["Median first response (days)", data.responseTimeMetrics.medianResponseTime.toFixed(1)]))
  lines.push(row(["Escalation rate", `${Math.round(data.responseTimeMetrics.escalationRate * 100)}%`]))
  lines.push("")

  lines.push(row(["Petitions by status"]))
  lines.push(row(["Status", "Count"]))
  for (const [status, count] of Object.entries(data.ticketsByStatus)) {
    lines.push(row([statusLabel(status), count]))
  }
  lines.push("")

  lines.push(row(["Petitions by type"]))
  lines.push(row(["Type", "Count"]))
  for (const [type, count] of Object.entries(data.ticketsByType)) {
    lines.push(row([typeLabel(type), count]))
  }
  lines.push("")

  lines.push(row(["Petitions by department"]))
  lines.push(row(["Department", "Count"]))
  for (const [group, count] of Object.entries(data.ticketsByGroup)) {
    lines.push(row([group, count]))
  }
  lines.push("")

  lines.push(row(["Monthly trends"]))
  lines.push(row(["Month", "Submitted", "Resolved"]))
  for (const m of data.monthlyTrends) {
    lines.push(row([m.month, m.count, m.resolved]))
  }
  lines.push("")

  lines.push(row(["Audit log (latest)"]))
  lines.push(row(["Timestamp", "User", "Role", "Action", "Petition ID", "Details"]))
  for (const log of auditLogs) {
    lines.push(
      row([
        log.timestamp.toISOString(),
        log.userId,
        log.userRole,
        log.action,
        log.ticketId ?? "",
        log.details,
      ])
    )
  }

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const stamp = generated.slice(0, 10)
  const link = document.createElement("a")
  link.href = url
  link.download = `petition-analytics-${stamp}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
