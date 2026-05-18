import type { Ticket } from "@/lib/types"

const PREFIX = "PET"

/**
 * Human-friendly reference: PET-2024-001
 * Uses stored referenceCode when present; stable fallback for older rows.
 */
export function formatTicketRef(
  ticket: Pick<Ticket, "id" | "submittedAt" | "referenceCode">
): string {
  if (ticket.referenceCode?.trim()) {
    return ticket.referenceCode.trim()
  }

  const year = ticket.submittedAt.getFullYear()
  const compact = ticket.id.replace(/-/g, "")
  const tail = compact.slice(-6)
  const sequence = (Number.parseInt(tail, 16) % 999) + 1
  return `${PREFIX}-${year}-${String(sequence).padStart(3, "0")}`
}

/** Parse PET-2024-001 for search (returns year + sequence if valid). */
export function parseTicketRef(ref: string): { year: number; sequence: number } | null {
  const m = ref.trim().match(/^PET-(\d{4})-(\d{3,4})$/i)
  if (!m) return null
  return { year: Number(m[1]), sequence: Number(m[2]) }
}
