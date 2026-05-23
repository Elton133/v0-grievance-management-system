import { Router } from "express"
import { authMiddleware } from "../middleware/auth"
import {
  listRegistry,
  createRegistryEntry,
  deleteRegistryEntry,
  bulkUploadRegistry,
  registryStatus,
  validateRegistryMember,
} from "../controllers/registryController"

const router = Router()

router.get("/status", registryStatus)
router.post("/validate", validateRegistryMember)
router.get("/", authMiddleware, listRegistry)
router.post("/", authMiddleware, createRegistryEntry)
router.post("/bulk", authMiddleware, bulkUploadRegistry)
router.delete("/:id", authMiddleware, deleteRegistryEntry)

export default router
