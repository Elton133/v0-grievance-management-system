import { Router } from "express"
import { createTicketV1, getTicketsV1, getTicketByIdV1 } from "../../controllers/v1/ticketController"

const router = Router()

// Public REST API v1 for Tickets
// Note: apiAuthMiddleware should be applied in server.ts for /api/v1 prefix, or per-route here

router.post("/", createTicketV1)
router.get("/", getTicketsV1)
router.get("/:id", getTicketByIdV1)

export default router
