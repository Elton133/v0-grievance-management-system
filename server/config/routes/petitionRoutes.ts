import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  createPetition,
  getPetitions,
  getPetitionById,
  updatePetitionStatus,
  addComment,
  getUserPetitions
} from "../controllers/petitionController";

const router = Router();

// All petition routes require authentication
router.use(authMiddleware);

// POST /api/petitions - Create a new petition
router.post("/", createPetition);

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

export default router;
