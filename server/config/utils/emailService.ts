import nodemailer from "nodemailer";
import { sendEmailViaResend, isResendConfigured } from "./resendService";
import prisma from "../db";
import {
  type EmailBranding,
  escapeHtml,
  renderBrandedEmail,
  emailButton,
  emailDetailCard,
  resolveLogoUrlForEmail,
} from "./emailHtml";
import {
  PETITION_CHAIN_OF_COMMAND,
  formatWorkflowRole,
  getStudentPetitionUpdateCopy,
} from "./workflowLabels";

/** True when the app can attempt to send mail (Resend API key or full SMTP credentials). */
export function isEmailSendingConfigured(): boolean {
  if (isResendConfigured()) return true;
  return !!(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS);
}

// Cache settings to avoid DB query on every email
let cachedSettings: {
  organizationName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  supportEmail: string | null;
} | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Get tenant branding for email templates (logo URL resolved for absolute email links).
 */
const getTenantBranding = async (): Promise<EmailBranding> => {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return {
      orgName: cachedSettings.organizationName,
      primaryColor: cachedSettings.primaryColor,
      accentColor: cachedSettings.accentColor,
      logoAbsoluteUrl: resolveLogoUrlForEmail(cachedSettings.logoUrl),
      supportEmail: cachedSettings.supportEmail,
    };
  }
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
    if (settings) {
      cachedSettings = {
        organizationName: settings.organizationName,
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
        logoUrl: settings.logoUrl,
        supportEmail: settings.supportEmail,
      };
      cacheTimestamp = now;
      return {
        orgName: settings.organizationName,
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
        logoAbsoluteUrl: resolveLogoUrlForEmail(settings.logoUrl),
        supportEmail: settings.supportEmail,
      };
    }
  } catch {
    // Fall through to defaults
  }
  return {
    orgName: "Grievance Management System",
    primaryColor: "#2563eb",
    accentColor: "#1e40af",
    logoAbsoluteUrl: resolveLogoUrlForEmail(null),
    supportEmail: null,
  };
};

// Email service configuration
const createTransporter = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587");
  const isSecure = port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS environment variables are required");
  }

  if (host.includes("gmail.com")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: { user, pass },
  });
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: EmailOptions): Promise<boolean> => {
  const startTime = Date.now();

  // Prefer Resend if configured
  if (isResendConfigured()) {
    console.log(`[Email Service] Using Resend to send email to ${to}`);
    const success = await sendEmailViaResend(to, subject, html);
    if (success) {
      const duration = Date.now() - startTime;
      console.log(`[Email Service] ✅ Email sent via Resend (${duration}ms)`);
      return true;
    }
    console.log(`[Email Service] ⚠️ Resend failed, falling back to SMTP`);
  }

  try {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.error(`[Email Service] ❌ Neither Resend nor SMTP configured. Cannot send email to ${to}`);
      return false;
    }

    const transporter = createTransporter();
    const fromAddress = process.env.SMTP_FROM || `"Grievance Management System" <${smtpUser}>`;

    const sendTimeout = 30000;
    const info = await Promise.race([
      transporter.sendMail({ from: fromAddress, to, subject, html }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Email send timeout after ${sendTimeout}ms`)), sendTimeout)
      )
    ]) as any;

    const duration = Date.now() - startTime;
    console.log(`[Email Service] ✅ Email sent via SMTP (${duration}ms) - ID: ${info.messageId || "N/A"}`);
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Email Service] ❌ Error sending email (took ${duration}ms):`, error.message);
    return false;
  }
};

// Email templates — branded layout, fonts, logo (TenantSettings), HTML-escaped dynamic text
export const emailTemplates = {
  newTicketAssigned: async (reviewerName: string, submitterName: string, ticketSubject: string, ticketId: string) => {
    const branding = await getTenantBranding();
    const receivedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    const bodyHtml = `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(reviewerName)},</p>
      <p style="margin:0 0 16px;">A new grievance has been assigned to you for review. Please log in to the staff portal and respond within the timeframes set by your department.</p>
      ${emailDetailCard([
        { label: "Student", value: submitterName },
        { label: "Subject", value: ticketSubject },
        { label: "Reference", value: ticketId },
        { label: "Notified", value: receivedAt },
      ])}
      <p style="margin:20px 0 0;font-size:14px;color:#475569;">If you are not the correct reviewer, contact your administrator so the case can be reassigned.</p>
      <p style="margin:24px 0 0;font-size:15px;">Best regards,<br /><strong>${escapeHtml(branding.orgName)}</strong></p>
    `;
    return {
      subject: `New grievance assigned: ${ticketSubject}`,
      html: renderBrandedEmail({
        branding,
        preheader: `New case from ${submitterName} — ${ticketSubject}`,
        headline: "New grievance assigned",
        bodyHtml,
      }),
    };
  },

  /** Sent to the student/submitter immediately after they file a petition */
  ticketSubmissionConfirmation: async (
    submitterName: string,
    ticketSubject: string,
    referenceCode: string,
    ticketUuid: string
  ) => {
    const branding = await getTenantBranding();
    const baseUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
      "http://localhost:3000";
    const ticketUrl = `${baseUrl.replace(/\/$/, "")}/ticket/${ticketUuid}`;
    const submittedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    const chainList = PETITION_CHAIN_OF_COMMAND.map((s) => `<li>${escapeHtml(s)}</li>`).join("");

    const bodyHtml = `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(submitterName)},</p>
      <p style="margin:0 0 16px;">Thank you for submitting your petition to <strong>${escapeHtml(branding.orgName)}</strong>. You will receive an email each time a reviewer acts on your case.</p>
      ${emailDetailCard([
        { label: "Subject", value: ticketSubject },
        { label: "Reference", value: referenceCode },
        { label: "Submitted", value: submittedAt },
      ])}
      <p style="margin:0 0 8px;font-size:14px;color:#475569;"><strong>Chain of command</strong></p>
      <ol style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#475569;line-height:1.6;">
        ${chainList}
      </ol>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;">Keep reference <strong>${escapeHtml(referenceCode)}</strong>. Only the Registrar can approve or reject your petition.</p>
      ${emailButton(ticketUrl, "View petition in portal", branding.primaryColor)}
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Link: <span style="word-break:break-all;">${escapeHtml(ticketUrl)}</span></p>
      <p style="margin:24px 0 0;font-size:15px;">Best regards,<br /><strong>${escapeHtml(branding.orgName)}</strong></p>
    `;

    return {
      subject: `Petition received (${referenceCode}): ${ticketSubject}`,
      html: renderBrandedEmail({
        branding,
        preheader: `${referenceCode} — routed to your Class Advisor`,
        headline: "Petition submitted",
        bodyHtml,
      }),
    };
  },

  petitionStudentUpdate: async (params: {
    submitterName: string;
    ticketSubject: string;
    referenceCode: string;
    ticketUuid: string;
    newStatus: string;
    actorName: string;
    actorRole: string;
    comment?: string | null;
  }) => {
    const branding = await getTenantBranding();
    const baseUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
      "http://localhost:3000";
    const portalUrl = `${baseUrl.replace(/\/$/, "")}/ticket/${params.ticketUuid}`;
    const updatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    const copy = getStudentPetitionUpdateCopy(params.newStatus, params.actorName, params.actorRole);
    const roleLabel = formatWorkflowRole(params.actorRole);

    const commentBlock = params.comment?.trim()
      ? `<div style="margin:18px 0;padding:16px 18px;background-color:#f0f9ff;border-radius:10px;border:1px solid #bae6fd;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#0369a1;">Comment from ${escapeHtml(roleLabel)}</p>
          <p style="margin:0;font-size:14px;color:#0c4a6e;line-height:1.55;white-space:pre-wrap;">${escapeHtml(params.comment.trim())}</p>
        </div>`
      : "";

    const bodyHtml = `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(params.submitterName)},</p>
      <p style="margin:0 0 16px;">${escapeHtml(copy.summary)}</p>
      ${emailDetailCard([
        { label: "Reference", value: params.referenceCode },
        { label: "Subject", value: params.ticketSubject },
        { label: "Action by", value: `${roleLabel} — ${params.actorName}` },
        { label: "When", value: updatedAt },
      ])}
      ${commentBlock}
      <p style="margin:18px 0 8px;font-size:14px;color:#475569;"><strong>What happens next</strong></p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">${escapeHtml(copy.nextStep)}</p>
      ${emailButton(portalUrl, "View full activity log", branding.primaryColor)}
      <p style="margin:24px 0 0;font-size:15px;">Best regards,<br /><strong>${escapeHtml(branding.orgName)}</strong></p>
    `;

    return {
      subject: `${copy.headline} (${params.referenceCode})`,
      html: renderBrandedEmail({
        branding,
        preheader: `${roleLabel} ${params.actorName}`,
        headline: copy.headline,
        bodyHtml,
      }),
    };
  },

  petitionStudentComment: async (params: {
    submitterName: string;
    ticketSubject: string;
    referenceCode: string;
    ticketUuid: string;
    actorName: string;
    actorRole: string;
    comment: string;
  }) => {
    const branding = await getTenantBranding();
    const baseUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
      "http://localhost:3000";
    const portalUrl = `${baseUrl.replace(/\/$/, "")}/ticket/${params.ticketUuid}`;
    const roleLabel = formatWorkflowRole(params.actorRole);
    const at = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

    const bodyHtml = `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(params.submitterName)},</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(roleLabel)} ${escapeHtml(params.actorName)}</strong> added a comment. Your petition status has not changed.</p>
      ${emailDetailCard([
        { label: "Reference", value: params.referenceCode },
        { label: "Subject", value: params.ticketSubject },
        { label: "From", value: `${roleLabel} — ${params.actorName}` },
        { label: "When", value: at },
      ])}
      <div style="margin:18px 0;padding:16px 18px;background-color:#f0f9ff;border-radius:10px;border:1px solid #bae6fd;">
        <p style="margin:0;font-size:14px;color:#0c4a6e;line-height:1.55;white-space:pre-wrap;">${escapeHtml(params.comment)}</p>
      </div>
      <p style="margin:16px 0;font-size:14px;color:#475569;">Only the <strong>Registrar</strong> can approve or reject your petition.</p>
      ${emailButton(portalUrl, "View petition", branding.primaryColor)}
      <p style="margin:24px 0 0;font-size:15px;">Best regards,<br /><strong>${escapeHtml(branding.orgName)}</strong></p>
    `;

    return {
      subject: `Comment on ${params.referenceCode} — ${roleLabel}`,
      html: renderBrandedEmail({
        branding,
        preheader: `${roleLabel} ${params.actorName} commented`,
        headline: "New comment on your petition",
        bodyHtml,
      }),
    };
  },

  ticketStatusUpdate: async (submitterName: string, ticketSubject: string, newStatus: string, comment?: string) => {
    const branding = await getTenantBranding();
    const statusMessages: Record<string, string> = {
      under_review: "is now under review",
      forwarded_to_hod: "has been forwarded to the next reviewer",
      forwarded_to_registrar: "has been forwarded to the final reviewer",
      resolved: "has been resolved",
      rejected: "has been rejected",
    };
    const statusLabels: Record<string, string> = {
      under_review: "Under review",
      forwarded_to_hod: "Forwarded (next level)",
      forwarded_to_registrar: "Forwarded (registrar)",
      resolved: "Resolved",
      rejected: "Rejected",
    };

    const message = statusMessages[newStatus] || "status has been updated";
    const statusLabel = statusLabels[newStatus] || newStatus;
    const updatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

    const commentBlock =
      comment ?
        `<div style="margin:18px 0;padding:16px 18px;background-color:#fffbeb;border-radius:10px;border:1px solid #fde68a;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.04em;">Staff comment</p>
          <p style="margin:0;font-size:14px;color:#78350f;line-height:1.55;white-space:pre-wrap;">${escapeHtml(comment)}</p>
        </div>`
      : "";

    const bodyHtml = `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(submitterName)},</p>
      <p style="margin:0 0 16px;">Your grievance <strong>${escapeHtml(ticketSubject)}</strong> ${escapeHtml(message)}.</p>
      ${emailDetailCard([
        { label: "Status", value: statusLabel },
        { label: "Updated", value: updatedAt },
      ])}
      ${commentBlock}
      <p style="margin:20px 0 0;font-size:14px;color:#475569;">You can review the full history and any attachments by signing in to the student portal.</p>
      <p style="margin:24px 0 0;font-size:15px;">Best regards,<br /><strong>${escapeHtml(branding.orgName)}</strong></p>
    `;

    return {
      subject: `Grievance update: ${ticketSubject}`,
      html: renderBrandedEmail({
        branding,
        preheader: `${statusLabel} — ${ticketSubject}`,
        headline: "Grievance status update",
        bodyHtml,
      }),
    };
  },

  nextReviewerAlert: async (
    reviewerName: string,
    submitterName: string,
    ticketSubject: string,
    ticketId: string,
    currentLevel: string
  ) => {
    const branding = await getTenantBranding();
    const forwardedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    const bodyHtml = `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(reviewerName)},</p>
      <p style="margin:0 0 16px;">A grievance has been escalated and is now waiting for your action in the workflow.</p>
      ${emailDetailCard([
        { label: "Student", value: submitterName },
        { label: "Subject", value: ticketSubject },
        { label: "Reference", value: ticketId },
        { label: "Stage", value: currentLevel },
        { label: "Forwarded", value: forwardedAt },
      ])}
      <p style="margin:20px 0 0;font-size:14px;color:#475569;">Please review the case, add notes if required, and move it to the next status according to institutional policy.</p>
      <p style="margin:24px 0 0;font-size:15px;">Best regards,<br /><strong>${escapeHtml(branding.orgName)}</strong></p>
    `;
    return {
      subject: `Grievance forwarded for review: ${ticketSubject}`,
      html: renderBrandedEmail({
        branding,
        preheader: `Action required — ${ticketSubject}`,
        headline: "Grievance forwarded to you",
        bodyHtml,
      }),
    };
  },

  emailVerification: async (userName: string, verificationToken: string, userEmail?: string) => {
    const branding = await getTenantBranding();
    const baseUrl =
      process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3000";
    const emailQuery = userEmail ? `&email=${encodeURIComponent(userEmail)}` : "";
    const verificationUrl = `${baseUrl.replace(/\/$/, "")}/verify-email?token=${verificationToken}${emailQuery}`;

    const bodyHtml = `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(userName)},</p>
      <p style="margin:0 0 16px;">Thank you for registering with <strong>${escapeHtml(branding.orgName)}</strong>. Confirm your email address to activate your account and access the grievance portal.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#475569;">For your security, this link expires in <strong>24 hours</strong>. If you did not create an account, you can ignore this message.</p>
      ${emailButton(verificationUrl, "Verify email address", branding.primaryColor)}
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Or paste this link into your browser:<br /><span style="word-break:break-all;">${escapeHtml(verificationUrl)}</span></p>
      <p style="margin:24px 0 0;font-size:15px;">Best regards,<br /><strong>${escapeHtml(branding.orgName)}</strong></p>
    `;

    return {
      subject: `Verify your email — ${branding.orgName}`,
      html: renderBrandedEmail({
        branding,
        preheader: "Confirm your email to finish signing up.",
        headline: "Verify your email",
        bodyHtml,
      }),
    };
  },

  passwordReset: async (userName: string, resetToken: string) => {
    const branding = await getTenantBranding();
    const baseUrl =
      process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3000";
    const resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${resetToken}`;

    const bodyHtml = `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(userName)},</p>
      <p style="margin:0 0 16px;">We received a request to reset the password for your <strong>${escapeHtml(branding.orgName)}</strong> account. Use the button below to choose a new password.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#b45309;background-color:#fffbeb;padding:12px 14px;border-radius:8px;border:1px solid #fde68a;"><strong>Security tip:</strong> This link expires in <strong>1 hour</strong>. If you did not request a reset, ignore this email — your password will stay the same.</p>
      ${emailButton(resetUrl, "Reset password", branding.primaryColor)}
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Link not working? Copy and paste:<br /><span style="word-break:break-all;">${escapeHtml(resetUrl)}</span></p>
      <p style="margin:24px 0 0;font-size:15px;">Best regards,<br /><strong>${escapeHtml(branding.orgName)}</strong></p>
    `;

    return {
      subject: `Reset your password — ${branding.orgName}`,
      html: renderBrandedEmail({
        branding,
        preheader: "Password reset requested for your account.",
        headline: "Reset your password",
        bodyHtml,
      }),
    };
  },
};

/**
 * Check email service configuration status
 */
export const checkEmailConfiguration = () => {
  const resendConfigured = isResendConfigured();
  const smtpConfigured = !!(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());

  const config = {
    provider: resendConfigured ? "Resend" : smtpConfigured ? "SMTP" : "None",
    resendApiKey: process.env.RESEND_API_KEY ? "✅ SET" : "❌ NOT SET",
    resendFromEmail: process.env.RESEND_FROM_EMAIL || "Using default",
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: process.env.SMTP_PORT || "587",
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS ? "***" : undefined,
    smtpFrom: process.env.SMTP_FROM,
    isConfigured: isEmailSendingConfigured(),
  };

  console.log("[Email Service] Configuration Status:");
  console.log(`  Provider: ${config.provider}`);
  if (resendConfigured) {
    console.log(`  RESEND_API_KEY: ${config.resendApiKey}`);
    console.log(`  RESEND_FROM_EMAIL: ${config.resendFromEmail}`);
  }
  console.log(`  Status: ${config.isConfigured ? "✅ CONFIGURED" : "❌ NOT CONFIGURED"}`);

  return config;
};
