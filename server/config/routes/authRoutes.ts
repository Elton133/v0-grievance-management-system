import { Router } from "express";
import { 
  loginUser, 
  registerUser, 
  verifyEmail, 
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

// POST /api/auth/register
router.post("/register", authLimiter, registerUser);

// POST /api/auth/login
router.post("/login", authLimiter, loginUser);

// POST /api/auth/verify-email - Verify email with token
router.post("/verify-email", authLimiter, verifyEmail);

// POST /api/auth/resend-verification - Resend verification email
router.post("/resend-verification", authLimiter, resendVerificationEmail);

// POST /api/auth/forgot-password - Request password reset
router.post("/forgot-password", authLimiter, requestPasswordReset);

// POST /api/auth/reset-password - Reset password with token
router.post("/reset-password", authLimiter, resetPassword);

export default router;
