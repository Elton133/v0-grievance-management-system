import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { apiLimiter } from "../middleware/rateLimiter";
import { getAuditLogs } from "../controllers/auditController";

const router = Router();

router.use(apiLimiter);
router.use(authMiddleware);
router.get("/", getAuditLogs);

export default router;
