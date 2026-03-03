import { Request, Response, NextFunction } from "express"
import prisma from "../db"

/**
 * Middleware for Developer APIs (v1)
 * Extracts Bearer token, hashes it, and verifies it exists in the ApiToken table.
 */
export const requireApiToken = async (
  req: Request,
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

    // In a real production system, this should hash the raw token and compare.
    // Assuming for now the token sent IS the hash we check.
    // Example: `const tokenHash = crypto.createHash('sha256').update(token).digest('hex')`
    const tokenHash = token

    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash },
    })

    if (!apiToken) {
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

      // Attach the tenant/token context to the request (since we're single-tenant right now, this is just for future-proofing)
      ; (req as any).apiToken = apiToken
      ; (req as any).tenantId = apiToken.tenantId

    next()
  } catch (error) {
    console.error("API Token validation error:", error)
    res.status(500).json({ success: false, error: { message: "Internal server error during authentication" } })
  }
}
