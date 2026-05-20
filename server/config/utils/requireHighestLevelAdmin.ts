import { Response } from "express"
import prisma from "../db"
import { AuthRequest } from "../middleware/auth"

type RoleConfig = { key: string; level: number }

const DEFAULT_ROLES: RoleConfig[] = [
  { key: "student", level: 0 },
  { key: "advisor", level: 1 },
  { key: "hod", level: 2 },
  { key: "registrar", level: 3 },
]

/**
 * Ensures the authenticated user has the highest role level in tenant config (e.g. registrar).
 * Returns the acting user on success; sends 401/403/404 and returns null otherwise.
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

  const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } })
  const roles =
    (settings?.rolesConfig as RoleConfig[] | undefined)?.length
      ? (settings!.rolesConfig as RoleConfig[])
      : DEFAULT_ROLES

  const userRoleConfig = roles.find((r) => r.key === user.role)
  const maxLevel = Math.max(...roles.map((r) => r.level))

  if (!userRoleConfig || userRoleConfig.level < maxLevel) {
    res.status(403).json({
      error: "Only the highest-level administrator can perform this action",
    })
    return null
  }

  return user
}
