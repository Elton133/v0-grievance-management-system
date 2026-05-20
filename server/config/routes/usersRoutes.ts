import { Router } from "express"
import { authMiddleware } from "../middleware/auth"
import { createStaffUser, listStaffUsers } from "../controllers/usersController"

const router = Router()

router.get("/staff", authMiddleware, listStaffUsers)
router.post("/staff", authMiddleware, createStaffUser)

export default router
