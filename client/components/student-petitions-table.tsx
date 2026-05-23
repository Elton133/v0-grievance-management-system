"use client"

import { useState } from "react"
import type { Ticket } from "@/lib/types"
import { useSettings } from "@/lib/settings-context"
import { formatTicketRef } from "@/lib/ticket-ref"
import { petitionSubjectLabel, petitionTypeLabel } from "@/lib/petition-form-options"
import { formatDateDDMMYYYY } from "@/lib/date-format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PetitionProgressBar } from "@/components/petition-progress-bar"

type Props = {
  tickets: Ticket[]
}

export function StudentPetitionsTable({ tickets }: Props) {
  const { settings, getStatusLabel, getStatusColor } = useSettings()
  const [selected, setSelected] = useState<Ticket | null>(null)

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="font-mono text-xs">{formatTicketRef(ticket)}</TableCell>
                <TableCell>{petitionSubjectLabel(ticket.subject)}</TableCell>
                <TableCell>{petitionTypeLabel(ticket.type)}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={{ borderColor: getStatusColor(ticket.status), color: getStatusColor(ticket.status) }}
                  >
                    {getStatusLabel(ticket.status)}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(ticket.submittedAt)}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setSelected(ticket)}>
                    View details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{formatTicketRef(selected)}</DialogTitle>
              </DialogHeader>
              <PetitionProgressBar ticket={selected} settings={settings} />
              <div className="space-y-3 text-sm">
                <p><span className="font-medium">Subject:</span> {petitionSubjectLabel(selected.subject)}</p>
                <p><span className="font-medium">Type:</span> {petitionTypeLabel(selected.type)}</p>
                <p><span className="font-medium">Level:</span> {selected.year}</p>
                <p><span className="font-medium">Status:</span> {getStatusLabel(selected.status)}</p>
                <p><span className="font-medium">Submitted:</span> {formatDateDDMMYYYY(selected.submittedAt)}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{selected.description}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
