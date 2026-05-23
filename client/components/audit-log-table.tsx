import { useMemo, useState } from "react"
import type { AuditLog } from "@/lib/analytics-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, User, Settings, ArrowRight, CheckCircle, XCircle } from "lucide-react"
import { formatDateTimeDDMMYYYY } from "@/lib/date-format"

interface AuditLogTableProps {
  logs: AuditLog[]
  title?: string
  description?: string
  showFilters?: boolean
}

function formatAuditLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const actionIcons: Record<string, typeof FileText> = {
  PETITION_SUBMITTED: FileText,
  TICKET_SUBMITTED: FileText,
  STATUS_UPDATE: Settings,
  PETITION_ASSIGNED: ArrowRight,
  TICKET_FORWARDED: ArrowRight,
  COMMENT_ADDED: FileText,
  PETITION_UPDATED: Settings,
  PETITION_DELETED: XCircle,
  ATTACHMENT_ADDED: FileText,
  LOGIN: User,
  LOGOUT: User,
}

const actionColors: Record<string, string> = {
  PETITION_SUBMITTED: "bg-blue-100 text-blue-800",
  TICKET_SUBMITTED: "bg-blue-100 text-blue-800",
  STATUS_UPDATE: "bg-yellow-100 text-yellow-800",
  PETITION_ASSIGNED: "bg-purple-100 text-purple-800",
  TICKET_FORWARDED: "bg-purple-100 text-purple-800",
  COMMENT_ADDED: "bg-sky-100 text-sky-800",
  PETITION_UPDATED: "bg-orange-100 text-orange-800",
  PETITION_DELETED: "bg-red-100 text-red-800",
  ATTACHMENT_ADDED: "bg-gray-100 text-gray-800",
  LOGIN: "bg-gray-100 text-gray-800",
  LOGOUT: "bg-gray-100 text-gray-800",
}

export function AuditLogTable({
  logs,
  title = "Audit Log",
  description = "System activity and changes",
  showFilters = false,
}: AuditLogTableProps) {
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).sort(),
    [logs]
  )
  const roleOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.userRole))).sort(),
    [logs]
  )

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false
      if (roleFilter !== "all" && log.userRole !== roleFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          log.details.toLowerCase().includes(q) ||
          log.userId.toLowerCase().includes(q) ||
          formatAuditLabel(log.action).toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [logs, actionFilter, roleFilter, search])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Input
              placeholder="Search details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actionOptions.map((a) => (
                  <SelectItem key={a} value={a}>{formatAuditLabel(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No audit entries yet. Actions such as petition submissions, forwards, and
                    registrar decisions will appear here.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((log) => {
                const ActionIcon = actionIcons[log.action as keyof typeof actionIcons] || Settings
                const actionColor = actionColors[log.action as keyof typeof actionColors] || "bg-gray-100 text-gray-800"

                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      <div>
                        <div>{formatDateTimeDDMMYYYY(log.timestamp)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.userId}</div>
                        <Badge variant="outline" className="text-xs">
                          {log.userRole.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={actionColor} variant="outline">
                        <ActionIcon className="mr-1 h-3 w-3" />
                        {formatAuditLabel(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-muted-foreground line-clamp-2">{log.details}</p>
                    </TableCell>
                    <TableCell>
                      {log.ticketId && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {log.ticketId}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
