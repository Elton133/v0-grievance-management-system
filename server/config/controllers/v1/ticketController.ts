import { Request, Response } from "express"
import prisma from "../../db"
import { autoAssignTicket, getNextReviewer } from "../../utils/workflowService"

// Temporary stub for the v1 Request interface extending from Express Request
interface ApiRequest extends Request {
  apiToken?: import(".prisma/client").ApiToken
  tenantId?: string
}

/**
 * Public REST API: Create a Ticket (Grievance)
 * Endpoint: POST /api/v1/tickets
 */
export const createTicketV1 = async (req: ApiRequest, res: Response): Promise<void> => {
  const { subject, description, type, priority, submitterEmail, submitterName, group, year } = req.body

  try {
    if (!subject || !description || !submitterEmail || !submitterName) {
      res.status(400).json({
        success: false,
        error: { message: "Missing required fields: subject, description, submitterEmail, submitterName" }
      })
      return
    }

    // Attempt to match an existing user by email, or create a stub reference
    // For a headless external API, we might just use the submitterEmail as the identifier if no user exists.
    let user = await prisma.user.findUnique({ where: { email: submitterEmail } })

    // We strictly need a submitterId for our current schema. 
    // In a real multi-tenant scenario, we might create a guest user if they don't exist.
    if (!user) {
      res.status(400).json({
        success: false,
        error: { message: "Submitter email does not match an existing registered user on the platform." }
      })
      return
    }

    const ticketGroup = group || user.group || "External"
    const ticketYear = year || "External"
    const ticketType = type || "general"

    const ticket = await prisma.ticket.create({
      data: {
        submitterId: user.id,
        submitterName,
        submitterEmail,
        group: ticketGroup,
        year: ticketYear,
        type: ticketType,
        subject,
        description,
        priority: priority || "medium",
        status: "submitted",
        escalationLevel: 1,
      },
    })

    // Trigger workflow rules independently of the frontend request lifecycle
    autoAssignTicket(ticket.id, 1, ticketGroup).catch(e => console.error("API Auto-assign failed:", e))

    // TODO: Trigger Webhook Dispatch for "ticket.created"

    res.status(201).json({
      success: true,
      data: {
        id: ticket.id,
        status: ticket.status,
        submittedAt: ticket.submittedAt
      }
    })
  } catch (error) {
    console.error("v1 createTicket error:", error)
    res.status(500).json({ success: false, error: { message: "Internal Server Error" } })
  }
}

/**
 * Public REST API: Get list of Tickets
 * Endpoint: GET /api/v1/tickets
 */
export const getTicketsV1 = async (req: ApiRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    // In a multi-tenant world, we would filter by req.tenantId here across all queries.
    const [total, tickets] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.findMany({
        select: {
          id: true,
          submitterName: true,
          submitterEmail: true,
          group: true,
          type: true,
          priority: true,
          subject: true,
          status: true,
          submittedAt: true,
          updatedAt: true
        },
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
      })
    ])

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("v1 getTickets error:", error)
    res.status(500).json({ success: false, error: { message: "Internal Server Error" } })
  }
}

/**
 * Public REST API: Get Ticket Status
 * Endpoint: GET /api/v1/tickets/:id
 */
export const getTicketByIdV1 = async (req: ApiRequest, res: Response): Promise<void> => {
  const { id } = req.params

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        submittedAt: true,
        updatedAt: true,
        assignedUser: {
          select: { name: true, role: true }
        }
      }
    })

    if (!ticket) {
      res.status(404).json({ success: false, error: { message: "Ticket not found" } })
      return
    }

    res.json({
      success: true,
      data: ticket
    })
  } catch (error) {
    console.error("v1 getTicketById error:", error)
    res.status(500).json({ success: false, error: { message: "Internal Server Error" } })
  }
}
