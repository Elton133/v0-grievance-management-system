import { Router } from "express";
import { z } from "zod";
import { demoRequestLimiter } from "../middleware/rateLimiter";
import { isEmailSendingConfigured, sendEmail } from "../utils/emailService";
import prisma from "../db";

const router = Router();
const requestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  organization: z.string().trim().min(2).max(160),
  message: z.string().trim().min(10).max(2000),
  source: z.string().trim().max(100).optional(),
});

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

router.post("/", demoRequestLimiter, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Please check your details." });
  }
  const { name, email, organization, message, source } = parsed.data;
  const lead = await prisma.demoRequest.create({
    data: { name, email, organization, message, source: source || req.header("referer") || null },
  });
  if (!isEmailSendingConfigured()) {
    return res.status(202).json({ id: lead.id, message: "Demo request received." });
  }
  const recipient = process.env.DEMO_REQUEST_EMAIL || process.env.SUPPORT_EMAIL || process.env.SMTP_USER;
  if (!recipient) return res.status(202).json({ id: lead.id, message: "Demo request received." });

  const sent = await sendEmail({
    to: recipient,
    subject: `Demo request from ${organization}`,
    html: `<h2>New Resolve demo request</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Institution:</strong> ${escapeHtml(organization)}</p><p><strong>What they want to improve:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
  });

  if (sent) {
    await sendEmail({
      to: email,
      subject: "We received your Resolve demo request",
      html: `<h2>Thanks, ${escapeHtml(name)}.</h2><p>We received your request for ${escapeHtml(organization)} and will contact you to arrange a focused walkthrough.</p>`,
    });
  }
  return res.status(202).json({ id: lead.id, message: "Demo request received." });
});

export default router;
