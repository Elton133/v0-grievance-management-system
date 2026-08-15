import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requirePlatformOwner } from "../middleware/platformOwner";
import { createLimiter } from "../middleware/rateLimiter";
import {
  createOrganization,
  listOrganizations,
  listWorkspaceRequests,
  listDemoRequests,
  requestWorkspace,
  updateOrganization,
} from "../controllers/organizationController";

export const workspaceRouter = Router();
workspaceRouter.post("/request", createLimiter, requestWorkspace);

export const platformRouter = Router();
platformRouter.use(authMiddleware, requirePlatformOwner);
platformRouter.get("/organizations", listOrganizations);
platformRouter.post("/organizations", createOrganization);
platformRouter.patch("/organizations/:id", updateOrganization);
platformRouter.get("/workspace-requests", listWorkspaceRequests);
platformRouter.get("/demo-requests", listDemoRequests);
