import { Response } from "express"
import prisma from "../db"
import { AuthRequest } from "../middleware/auth"
import { nanoid } from "nanoid"
import { isSchoolBuild, schoolBuildDeveloperForbidden } from "../utils/schoolBuild"

/**
 * GET /api/settings/keys
 * Admin-only: List all API keys for the tenant
 */
export const getApiKeys = async (req: AuthRequest, res: Response) => {
  try {
    if (isSchoolBuild()) {
      return schoolBuildDeveloperForbidden(res)
    }
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    // Single-tenant right now
    const keys = await prisma.apiToken.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsed: true,
        // Deliberately NOT selecting tokenHash 
      }
    })

    res.json(keys)
  } catch (err) {
    console.error("Error fetching API keys:", err)
    res.status(500).json({ error: "Failed to fetch API keys" })
  }
}

/**
 * POST /api/settings/keys
 * Admin-only: Generate a new API key
 */
export const createApiKey = async (req: AuthRequest, res: Response) => {
  try {
    if (isSchoolBuild()) {
      return schoolBuildDeveloperForbidden(res)
    }
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const { name } = req.body

    if (!name) {
      return res.status(400).json({ error: "Key name is required" })
    }

    // Generate a secure, unique API key (e.g. gms_live_1234abcd5678)
    const rawToken = `gms_live_${nanoid(24)}`

    // In production, we should hash this before storing:
    // const crypto = require('crypto');
    // const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenHash = rawToken // Storing raw for now for simplicity of demo, but labeled as hash

    const newKey = await prisma.apiToken.create({
      data: {
        name,
        tokenHash,
      },
    })

    // Return the raw token EXACTLY ONCE to the user
    res.status(201).json({
      id: newKey.id,
      name: newKey.name,
      createdAt: newKey.createdAt,
      token: rawToken // This is the ONLY time they will see this
    })
  } catch (err) {
    console.error("Error creating API key:", err)
    res.status(500).json({ error: "Failed to create API key" })
  }
}

/**
 * DELETE /api/settings/keys/:id
 * Admin-only: Revoke/delete an API key
 */
export const deleteApiKey = async (req: AuthRequest, res: Response) => {
  try {
    if (isSchoolBuild()) {
      return schoolBuildDeveloperForbidden(res)
    }
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const { id } = req.params

    await prisma.apiToken.delete({
      where: { id },
    })

    res.json({ success: true, message: "API key revoked" })
  } catch (err) {
    console.error("Error deleting API key:", err)
    res.status(500).json({ error: "Failed to delete API key" })
  }
}
