"use client"

import type { Ticket } from "@/lib/types"
import { formatTicketRef } from "@/lib/ticket-ref"
import { petitionSubjectLabel, petitionTypeLabel } from "@/lib/petition-form-options"
import { useSettings } from "@/lib/settings-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { Eye } from "lucide-react"
import { canUserActOnPetition } from "@/lib/reviewer-actions"

type AdminPetitionsTableProps = {
  petitions: Ticket[]
  userRole: string
}

export function AdminPetitionsTable({ petitions, userRole }: AdminPetitionsTableProps) {
  const { getStatusLabel, settings } = useSettings()

  return (
    <div className="rounded-md border hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {petitions.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{formatTicketRef(p)}</TableCell>
              <TableCell className="max-w-[200px] truncate font-medium">{petitionSubjectLabel(p.subject)}</TableCell>
              <TableCell>{p.submitterName}</TableCell>
              <TableCell>{p.year}</TableCell>
              <TableCell>{petitionTypeLabel(p.type)}</TableCell>
              <TableCell>
                <Badge variant="outline">{getStatusLabel(p.status)}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {p.submittedAt.toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {canUserActOnPetition(p, userRole, settings.rolesConfig) && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      Decide
                    </Badge>
                  )}
                  <Button asChild size="sm" variant={canUserActOnPetition(p, userRole, settings.rolesConfig) ? "default" : "ghost"}>
                    <Link href={`/ticket/${p.id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      Review
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
