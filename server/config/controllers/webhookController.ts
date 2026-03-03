import { Response } from "express"
import prisma from "../db"
import { AuthRequest } from "../middleware/auth"
import { nanoid } from "nanoid"

/**
 * GET /api/settings/webhooks
 * Admin-only: List all webhooks for the tenant
 */
export const getWebhooks = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const webhooks = await prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: "desc" },
    })

    res.json(webhooks)
  } catch (err) {
    console.error("Error fetching webhooks:", err)
    res.status(500).json({ error: "Failed to fetch webhooks" })
  }
}

/**
 * POST /api/settings/webhooks
 * Admin-only: Register a new webhook endpoint
 */
export const createWebhook = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const { url, events } = req.body

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "Endpoint URL and at least one event type are required" })
    }

    // Generate a signing secret (HMAC) for payloads
    const secret = `whsec_${nanoid(32)}`

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        url,
        events,
        secret,
        isActive: true,
      },
    })

    res.status(201).json(webhook)
  } catch (err) {
    console.error("Error creating webhook:", err)
    res.status(500).json({ error: "Failed to create webhook" })
  }
}

/**
 * DELETE /api/settings/webhooks/:id
 * Admin-only: Remove a webhook
 */
export const deleteWebhook = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const { id } = req.params

    await prisma.webhookEndpoint.delete({
      where: { id },
    })

    res.json({ success: true, message: "Webhook removed" })
  } catch (err) {
    console.error("Error deleting webhook:", err)
    res.status(500).json({ error: "Failed to delete webhook" })
  }
}

/**
 * PATCH /api/settings/webhooks/:id
 * Admin-only: Update webhook (e.g. toggle isActive)
 */
export const updateWebhook = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const { id } = req.params
    const { isActive, events } = req.body

    const updateData: any = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (events !== undefined) updateData.events = events

    const webhook = await prisma.webhookEndpoint.update({
      where: { id },
      data: updateData,
    })

    res.json(webhook)
  } catch (err) {
    console.error("Error updating webhook:", err)
    res.status(500).json({ error: "Failed to update webhook" })
  }
}
