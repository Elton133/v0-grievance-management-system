import { Response } from "express"
import { z } from "zod"
import { AuthRequest } from "../middleware/auth"
import { requireHighestLevelAdmin } from "../utils/requireHighestLevelAdmin"
import { schoolBuildBlocksRequest, schoolBuildSettingsForbidden } from "../utils/schoolBuild"
import {
  getEmailConfigurationSummary,
  isEmailSendingConfigured,
} from "../utils/emailProvider"
import { sendEmail } from "../utils/emailService"
import { renderBrandedEmail } from "../utils/emailHtml"
import prisma from "../db"
import { resolveLogoUrlForEmail } from "../utils/emailHtml"

const testEmailSchema = z.object({
  to: z.string().email("Enter a valid recipient email"),
})

/** GET /api/settings/email/status */
export const getEmailStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res)
    }
    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    res.json(getEmailConfigurationSummary())
  } catch (err) {
    console.error("[Email] getEmailStatus error:", err)
    res.status(500).json({ error: "Failed to read email configuration" })
  }
}

/** POST /api/settings/email/test — send a test message to any inbox */
export const sendTestEmail = async (req: AuthRequest, res: Response) => {
  try {
    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res)
    }

    const admin = await requireHighestLevelAdmin(req, res)
    if (!admin) return

    if (!isEmailSendingConfigured()) {
      return res.status(503).json({
        error: "Email is not configured. Set EMAIL_PROVIDER and provider credentials in server .env.",
      })
    }

    const parsed = testEmailSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid request",
      })
    }

    const { to } = parsed.data
    const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } })
    const orgName = settings?.organizationName || "Grievance Management System"
    const config = getEmailConfigurationSummary()

    const html = renderBrandedEmail({
      branding: {
        orgName,
        primaryColor: settings?.primaryColor || "#2563eb",
        accentColor: settings?.accentColor || "#1e40af",
        logoAbsoluteUrl: resolveLogoUrlForEmail(settings?.logoUrl ?? null),
        supportEmail: settings?.supportEmail ?? null,
      },
      preheader: "Test email from your grievance portal",
      headline: "Email test successful",
      bodyHtml: `
        <p style="margin:0 0 16px;">This is a test message from <strong>${orgName}</strong>.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#475569;">
          Provider: <strong>${config.provider}</strong><br />
          From: <strong>${config.from}</strong>
        </p>
        <p style="margin:0;font-size:14px;color:#475569;">
          If you received this in your inbox, petition notifications and verification emails should work for your defense demo.
        </p>
      `,
    })

    const sent = await sendEmail({
      to: to.toLowerCase().trim(),
      subject: `[Test] ${orgName} email delivery`,
      html,
    })

    if (!sent) {
      return res.status(502).json({
        error:
          "Send failed. Check server logs and provider dashboard (Brevo/SendGrid sender must be verified).",
      })
    }

    res.json({
      msg: `Test email sent to ${to}`,
      provider: config.provider,
      from: config.from,
    })
  } catch (err) {
    console.error("[Email] sendTestEmail error:", err)
    res.status(500).json({ error: "Failed to send test email" })
  }
}
