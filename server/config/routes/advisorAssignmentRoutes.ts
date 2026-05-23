import { Router } from "express"
import { authMiddleware } from "../middleware/auth"
import {
  listAdvisorAssignments,
  upsertAdvisorAssignment,
  deleteAdvisorAssignment,
} from "../controllers/advisorAssignmentController"

const router = Router()

router.get("/", authMiddleware, listAdvisorAssignments)
router.post("/", authMiddleware, upsertAdvisorAssignment)
router.delete("/:id", authMiddleware, deleteAdvisorAssignment)

export default router
