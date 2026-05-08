import type { Ticket } from "@/lib/types"

function getTicketPrefix(type?: string): "TK" | "PT" {
  if (!type) return "TK"
  return type.toLowerCase().includes("petition") ? "PT" : "TK"
}

/**
 * Stable human-friendly reference for UI/display.
 * Keeps UUID as the real backend identifier.
 */
export function formatTicketRef(ticket: Pick<Ticket, "id" | "submittedAt" | "type">): string {
  const year = ticket.submittedAt.getFullYear()
  const compact = ticket.id.replace(/-/g, "")
  const tail = compact.slice(-6)
  const sequence = (Number.parseInt(tail, 16) % 10000).toString().padStart(4, "0")
  return `${getTicketPrefix(ticket.type)}-${year}-${sequence}`
}

