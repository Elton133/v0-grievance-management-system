import { Response } from "express"
import { z } from "zod"
import prisma from "../db"
import { AuthRequest } from "../middleware/auth"
import { requireHighestLevelAdmin } from "../utils/requireHighestLevelAdmin"
import { schoolBuildBlocksRequest, schoolBuildSettingsForbidden } from "../utils/schoolBuild"
import {
  parseRegistryCsv,
  registryHasEntries,
  validateAgainstRegistry,
  isRegistrySchemaMissing,
} from "../utils/registryService"
import { respondIfDatabaseUnavailable } from "../utils/prismaConnectionErrors"
import { currentTenant } from "../utils/tenantContext"

const createSchema = z.object({
  memberType: z.enum(["student", "alumni"]),
  studentId: z.string().min(2),
  fullName: z.string().min(2),
  department: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  level: z.string().optional(),
})

export const listRegistry = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res)
    }
    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "10"), 10) || 10))
    const search = String(req.query.search || "").trim()
    const memberType = String(req.query.memberType || "").trim()
    const department = String(req.query.department || "").trim()

    const where: Record<string, unknown> = {}
    if (memberType === "student" || memberType === "alumni") where.memberType = memberType
    if (department) where.department = { equals: department, mode: "insensitive" }
    if (search) {
      where.OR = [
        { studentId: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    const [total, data] = await Promise.all([
      prisma.registryStudent.count({ where }),
      prisma.registryStudent.findMany({
        where,
        orderBy: [{ department: "asc" }, { fullName: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    if (isRegistrySchemaMissing(err)) {
      return res.status(503).json({
        error:
          "Registry tables are missing. Run: npx prisma db push --schema=config/prisma/schema.prisma (or execute server/config/prisma/migrations/manual_registry_tables.sql in Supabase).",
        schemaMissing: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
      })
    }
    console.error("[Registry] list error:", err)
    res.status(500).json({ error: "Failed to list registry" })
  }
}

export const createRegistryEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res)
    }
    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid data" })
    }

    const { memberType, studentId, fullName, department, email, level } = parsed.data
    const row = await prisma.registryStudent.create({
      data: {
        memberType,
        studentId: studentId.trim().toUpperCase(),
        fullName: fullName.trim(),
        department: department.trim(),
        email: email?.trim() || null,
        level: level?.trim() || null,
      },
    })
    res.status(201).json(row)
  } catch (err: unknown) {
    if (respondIfDatabaseUnavailable(res, err)) return
    const code = (err as { code?: string })?.code
    if (code === "P2002") {
      return res.status(400).json({ error: "This student ID already exists in the registry" })
    }
    res.status(500).json({ error: "Failed to create registry entry" })
  }
}

export const deleteRegistryEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res)
    }
    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    await prisma.registryStudent.delete({ where: { id: req.params.id } })
    res.json({ msg: "Deleted" })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    res.status(500).json({ error: "Failed to delete registry entry" })
  }
}

export const bulkUploadRegistry = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res)
    }
    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    const csv = String(req.body.csv || "")
    const rows = parseRegistryCsv(csv)
    if (rows.length === 0) {
      return res.status(400).json({ error: "No valid rows found in CSV" })
    }

    let created = 0
    let updated = 0
    for (const row of rows) {
      const existing = await prisma.registryStudent.findUnique({
        where: {
          organizationId_studentId: {
            organizationId: req.user!.organizationId,
            studentId: row.studentId,
          },
        },
      })
      if (existing) {
        await prisma.registryStudent.update({
          where: { id: existing.id },
          data: row,
        })
        updated++
      } else {
        await prisma.registryStudent.create({ data: row })
        created++
      }
    }

    res.json({ msg: "Bulk upload complete", created, updated, total: rows.length })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    res.status(500).json({ error: "Bulk upload failed" })
  }
}

/** GET /api/registry/status — whether registry validation is active (public). */
export const registryStatus = async (_req: AuthRequest, res: Response) => {
  try {
    const organizationId = currentTenant()?.organizationId
    if (!organizationId) return res.status(400).json({ enabled: false, error: "Workspace is required" })
    const enabled = await registryHasEntries(organizationId)
    res.json({ enabled })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    if (isRegistrySchemaMissing(err)) return res.json({ enabled: false, schemaMissing: true })
    res.status(500).json({ enabled: false })
  }
}

const validateBodySchema = z.object({
  memberType: z.enum(["student", "alumni"]),
  fullName: z.string().min(2),
  studentId: z.string().min(2),
  department: z.string().optional(),
})

/** POST /api/registry/validate — registration lookup (public). */
export const validateRegistryMember = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = validateBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ ok: false, errors: parsed.error.flatten() })
    }
    const { memberType, fullName, studentId, department } = parsed.data
    const organizationId = currentTenant()?.organizationId
    if (!organizationId) return res.status(400).json({ ok: false, message: "Workspace is required" })
    const result = await validateAgainstRegistry(
      organizationId,
      memberType,
      fullName,
      studentId,
      department
    )
    if (!result.ok) {
      return res.json({ ok: false, path: result.path, message: result.message })
    }
    res.json({ ok: true })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    res.status(500).json({ ok: false, message: "Validation unavailable" })
  }
}
