import { Response } from "express"
import prisma from "../db"
import { AuthRequest } from "../middleware/auth"
import { isSystemAdminRole } from "./roleUtils"

/**
 * Ensures the authenticated user is a system administrator (role: admin).
 * Not the same as registrar — admin manages platform settings, not petitions.
 */
export async function requireHighestLevelAdmin(
  req: AuthRequest,
  res: Response
): Promise<{ id: string; email: string; role: string } | null> {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" })
    return null
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!user) {
    res.status(404).json({ error: "User not found" })
    return null
  }

  if (!isSystemAdminRole(user.role)) {
    res.status(403).json({
      error: "Only system administrators can perform this action",
    })
    return null
  }

  return user
}
