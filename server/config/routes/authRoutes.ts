import { Router } from "express";
import { loginUser, registerUser } from "../controllers/authController";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

// POST /api/auth/register
router.post("/register", authLimiter, registerUser);

// POST /api/auth/login
router.post("/login", authLimiter, loginUser);

export default router;
