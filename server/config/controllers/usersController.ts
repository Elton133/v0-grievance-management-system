import { Response } from "express"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import prisma from "../db"
import { AuthRequest } from "../middleware/auth"
import { createStaffUserSchema } from "../validation/staffUserSchema"
import { sanitizeInput } from "../utils/sanitize"
import { normalizeAllowedEmailDomains } from "../utils/allowedEmailDomains"
import { effectiveGroupPrefixes } from "../utils/defaultGroupPrefixes"
import { requireHighestLevelAdmin } from "../utils/requireHighestLevelAdmin"
import { respondIfDatabaseUnavailable } from "../utils/prismaConnectionErrors"
import { schoolBuildBlocksRequest, schoolBuildSettingsForbidden } from "../utils/schoolBuild"

type RoleConfig = { key: string; isSubmitter?: boolean; groupScoped?: boolean }

async function loadTenantStaffConfig() {
  const settings = await prisma.tenantSettings.findFirst()
  const rolesConfig = (settings?.rolesConfig as RoleConfig[]) || []
  return {
    allowedEmailDomains: normalizeAllowedEmailDomains(settings?.allowedEmailDomains),
    rolesConfig,
    groupPrefixes: effectiveGroupPrefixes(settings?.groupPrefixes),
    staffRoleKeys: rolesConfig.filter((r) => r.isSubmitter !== true).map((r) => r.key),
  }
}

/** GET /api/users/staff — list staff accounts (advisor, hod, registrar, etc.) */
export const listStaffUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res)
    }

    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    const { staffRoleKeys } = await loadTenantStaffConfig()
    if (staffRoleKeys.length === 0) {
      return res.json({ data: [] })
    }

    const users = await prisma.user.findMany({
      where: { role: { in: staffRoleKeys } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        group: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    })

    res.json({ data: users })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    console.error("[Users] listStaffUsers error:", err)
    res.status(500).json({ error: "Failed to list staff users" })
  }
}

/** POST /api/users/staff — create advisor, HOD, or registrar account */
export const createStaffUser = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res)
    }

    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    const tenant = await loadTenantStaffConfig()
    const schema = createStaffUserSchema({
      allowedEmailDomains: tenant.allowedEmailDomains,
      rolesConfig: tenant.rolesConfig,
      groupPrefixes: tenant.groupPrefixes,
    })

    const validationResult = schema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }))
      return res.status(400).json({ msg: "Validation failed", errors })
    }

    const { name, email, password, role, group } = validationResult.data
    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId: req.user!.organizationId, email: normalizedEmail } },
    })
    if (existingUser) {
      return res.status(400).json({
        msg: "User already exists",
        errors: [{ field: "email", message: "An account with this email already exists" }],
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const groupValue = group ? sanitizeInput(group).trim() : null

    const user = await prisma.user.create({
      data: {
        name: sanitizeInput(name),
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role,
        group: groupValue,
        emailVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        group: true,
        emailVerified: true,
        createdAt: true,
      },
    })

    res.status(201).json({
      msg: "Staff account created",
      user,
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(400).json({
        msg: "User already exists",
        errors: [{ field: "email", message: "An account with this email already exists" }],
      })
    }
    if (respondIfDatabaseUnavailable(res, err)) return
    console.error("[Users] createStaffUser error:", err)
    res.status(500).json({ error: "Failed to create staff user" })
  }
}
