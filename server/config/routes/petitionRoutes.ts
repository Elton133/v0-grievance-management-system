import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { apiLimiter, createLimiter } from "../middleware/rateLimiter";
import {
  createPetition,
  getPetitions,
  getPetitionById,
  updatePetitionStatus,
  addComment,
  getUserPetitions,
  updatePetition,
  deletePetition,
  addAttachment,
  deleteAttachment,
} from "../controllers/petitionController";

const router = Router();

// Apply rate limiting to all petition routes first
router.use(apiLimiter);

// All petition routes require authentication
router.use(authMiddleware);

// POST /api/petitions - Create a new petition (with stricter rate limit)
router.post("/", createLimiter, createPetition);

// GET /api/petitions - Get all petitions
router.get("/", getPetitions);

// GET /api/petitions/my - Get current user's petitions
router.get("/my", getUserPetitions);

// GET /api/petitions/:id - Get a single petition by ID
router.get("/:id", getPetitionById);

// PATCH /api/petitions/:id/status - Update petition status
router.patch("/:id/status", updatePetitionStatus);

// POST /api/petitions/:id/comments - Add comment to petition
router.post("/:id/comments", addComment);

// PUT /api/petitions/:id - Update petition details (students only, submitted status only)
router.put("/:id", updatePetition);

// DELETE /api/petitions/:id - Delete petition (students only, submitted status only)
router.delete("/:id", deletePetition);

// POST /api/petitions/:id/attachments - Add attachment to petition
router.post("/:id/attachments", addAttachment);

// DELETE /api/petitions/:id/attachments/:attachmentId - Delete attachment from petition
router.delete("/:id/attachments/:attachmentId", deleteAttachment);

export default router;
