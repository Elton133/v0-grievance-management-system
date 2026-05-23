import type { Response } from "express"
import type { AuthRequest } from "../middleware/auth"
import prisma from "../db"
import { isSystemAdminRole } from "./roleUtils"

/**
 * School / thesis deployment: fixed org config, no tenant self-service.
 * Set SCHOOL_BUILD=true on the API server. Pair with NEXT_PUBLIC_SCHOOL_BUILD=true on the Next app.
 * System administrators (role: admin) can still use settings and developer APIs.
 */
export function isSchoolBuild(): boolean {
  const v = process.env.SCHOOL_BUILD?.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes"
}

export function schoolBuildSettingsForbidden(res: Response) {
  return res.status(403).json({
    error: "Organization settings are disabled in this deployment (school build).",
  })
}

export function schoolBuildDeveloperForbidden(res: Response) {
  return res.status(403).json({
    error: "Developer integrations are disabled in this deployment (school build).",
  })
}

/** School build blocks the request unless the authenticated user is a system admin. */
export async function schoolBuildBlocksRequest(req: AuthRequest, res: Response): Promise<boolean> {
  if (!isSchoolBuild()) return false
  if (!req.user?.id) return false

  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (user && isSystemAdminRole(user.role)) return false

  return true
}
