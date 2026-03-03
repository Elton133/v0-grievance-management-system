import { Router } from "express";
import { getSettings, updateSettings, resetSettings } from "../controllers/settingsController";
import { getApiKeys, createApiKey, deleteApiKey } from "../controllers/apiKeysController";
import { getWebhooks, createWebhook, deleteWebhook, updateWebhook } from "../controllers/webhookController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public — frontend fetches config on load
router.get("/", getSettings);

// Protected — admin updates
router.put("/", authMiddleware, updateSettings);

// Protected — reset to defaults
router.post("/reset", authMiddleware, resetSettings);

// --- Developer Settings (Admin Only) ---

// API Keys
router.get("/keys", authMiddleware, getApiKeys);
router.post("/keys", authMiddleware, createApiKey);
router.delete("/keys/:id", authMiddleware, deleteApiKey);

// Webhooks
router.get("/webhooks", authMiddleware, getWebhooks);
router.post("/webhooks", authMiddleware, createWebhook);
router.patch("/webhooks/:id", authMiddleware, updateWebhook);
router.delete("/webhooks/:id", authMiddleware, deleteWebhook);

export default router;
