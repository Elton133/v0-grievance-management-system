import { Response } from "express"
import { z } from "zod"
import prisma from "../db"
import { AuthRequest } from "../middleware/auth"
import { requireHighestLevelAdmin } from "../utils/requireHighestLevelAdmin"
import { schoolBuildBlocksRequest, schoolBuildSettingsForbidden } from "../utils/schoolBuild"
import { respondIfDatabaseUnavailable } from "../utils/prismaConnectionErrors"

const upsertSchema = z.object({
  advisorId: z.string().uuid(),
  department: z.string().min(1),
  levels: z.array(z.string()).min(1),
  petitionTypes: z.array(z.string()).optional().default([]),
})

export const listAdvisorAssignments = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) return schoolBuildSettingsForbidden(res)
    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    const department = String(req.query.department || "").trim()
    const where = department ? { department } : {}

    const data = await prisma.advisorLevelAssignment.findMany({
      where,
      include: {
        advisor: { select: { id: true, name: true, email: true, role: true, group: true } },
      },
      orderBy: [{ department: "asc" }, { createdAt: "asc" }],
    })
    res.json({ data })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    res.status(500).json({ error: "Failed to list advisor assignments" })
  }
}

export const upsertAdvisorAssignment = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) return schoolBuildSettingsForbidden(res)
    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() })
    }

    const { advisorId, department, levels, petitionTypes } = parsed.data
    const advisor = await prisma.user.findUnique({ where: { id: advisorId } })
    if (!advisor || advisor.role !== "advisor") {
      return res.status(400).json({ error: "Advisor account not found" })
    }

    const row = await prisma.advisorLevelAssignment.upsert({
      where: { advisorId_department: { advisorId, department } },
      create: { advisorId, department, levels, petitionTypes },
      update: { levels, petitionTypes },
      include: {
        advisor: { select: { id: true, name: true, email: true, role: true, group: true } },
      },
    })
    res.json({ data: row })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    res.status(500).json({ error: "Failed to save assignment" })
  }
}

export const deleteAdvisorAssignment = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) return schoolBuildSettingsForbidden(res)
    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    await prisma.advisorLevelAssignment.delete({ where: { id: req.params.id } })
    res.json({ msg: "Assignment removed" })
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return
    res.status(500).json({ error: "Failed to delete assignment" })
  }
}
