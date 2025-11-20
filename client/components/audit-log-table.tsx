import type { AuditLog } from "@/lib/analytics-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, User, Settings, ArrowRight, CheckCircle, XCircle } from "lucide-react"

interface AuditLogTableProps {
  logs: AuditLog[]
  title?: string
  description?: string
}

const actionIcons = {
  PETITION_SUBMITTED: FileText,
  STATUS_UPDATE: Settings,
  PETITION_FORWARDED: ArrowRight,
  PETITION_RESOLVED: CheckCircle,
  PETITION_REJECTED: XCircle,
  LOGIN: User,
  LOGOUT: User,
}

const actionColors = {
  PETITION_SUBMITTED: "bg-blue-100 text-blue-800",
  STATUS_UPDATE: "bg-yellow-100 text-yellow-800",
  PETITION_FORWARDED: "bg-purple-100 text-purple-800",
  PETITION_RESOLVED: "bg-green-100 text-green-800",
  PETITION_REJECTED: "bg-red-100 text-red-800",
  LOGIN: "bg-gray-100 text-gray-800",
  LOGOUT: "bg-gray-100 text-gray-800",
}

export function AuditLogTable({
  logs,
  title = "Audit Log",
  description = "System activity and changes",
}: AuditLogTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Petition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const ActionIcon = actionIcons[log.action as keyof typeof actionIcons] || Settings
                const actionColor = actionColors[log.action as keyof typeof actionColors] || "bg-gray-100 text-gray-800"

                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      <div>
                        <div>{log.timestamp.toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
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
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-muted-foreground line-clamp-2">{log.details}</p>
                    </TableCell>
                    <TableCell>
                      {log.petitionId && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {log.petitionId}
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
