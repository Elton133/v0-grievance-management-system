import { Request, Response, NextFunction } from "express"
import prisma from "../db"
import crypto from "crypto"
import type { OrganizationRequest } from "./organization"

/**
 * Middleware for Developer APIs (v1)
 * Extracts Bearer token, hashes it, and verifies it exists in the ApiToken table.
 */
export const requireApiToken = async (
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: { message: "Missing or invalid Authorization header. Expected 'Bearer <token>'" },
      })
      return
    }

    const token = authHeader.split(" ")[1]

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash },
    })

    if (!apiToken || apiToken.organizationId !== req.organization?.id) {
      res.status(401).json({
        success: false,
        error: { message: "Invalid or revoked API token" },
      })
      return
    }

    // Update last used timestamp in the background
    prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsed: new Date() }
    }).catch(e => console.error("Failed to update token lastUsed", e))

      // Attach the organization/token context to the request.
      ; (req as any).apiToken = apiToken
      ; (req as any).organizationId = apiToken.organizationId

    next()
  } catch (error) {
    console.error("API Token validation error:", error)
    res.status(500).json({ success: false, error: { message: "Internal server error during authentication" } })
  }
}
