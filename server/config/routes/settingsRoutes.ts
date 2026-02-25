import { Router } from "express";
import { getSettings, updateSettings, resetSettings } from "../controllers/settingsController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public — frontend fetches config on load
router.get("/", getSettings);

// Protected — admin updates
router.put("/", authMiddleware, updateSettings);

// Protected — reset to defaults
router.post("/reset", authMiddleware, resetSettings);

export default router;
