import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { apiLimiter, createLimiter } from "../middleware/rateLimiter";
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  addComment,
  getUserTickets,
  updateTicket,
  deleteTicket,
  addAttachment,
  uploadAttachmentFile,
  deleteAttachment,
} from "../controllers/ticketController";

const router = Router();

// Apply rate limiting to all ticket routes first
router.use(apiLimiter);

// All ticket routes require authentication
router.use(authMiddleware);

// POST /api/tickets - Create a new ticket (with stricter rate limit)
router.post("/", createLimiter, createTicket);

// GET /api/tickets - Get all tickets
router.get("/", getTickets);

// GET /api/tickets/my - Get current user's tickets
router.get("/my", getUserTickets);

// GET /api/tickets/:id - Get a single ticket by ID
router.get("/:id", getTicketById);

// PATCH /api/tickets/:id/status - Update ticket status
router.patch("/:id/status", updateTicketStatus);

// POST /api/tickets/:id/comments - Add comment to ticket
router.post("/:id/comments", addComment);

// PUT /api/tickets/:id - Update ticket details (submitters only, submitted status only)
router.put("/:id", updateTicket);

// DELETE /api/tickets/:id - Delete ticket (submitters only, submitted status only)
router.delete("/:id", deleteTicket);

// POST /api/tickets/:id/attachments/upload - Upload file via server (Supabase service role)
router.post("/:id/attachments/upload", uploadAttachmentFile);

// POST /api/tickets/:id/attachments - Register attachment metadata (legacy / external URL)
router.post("/:id/attachments", addAttachment);

// DELETE /api/tickets/:id/attachments/:attachmentId - Delete attachment from ticket
router.delete("/:id/attachments/:attachmentId", deleteAttachment);

export default router;
