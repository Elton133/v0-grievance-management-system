import nodemailer from "nodemailer";
import { sendEmailViaResend, isResendConfigured } from "./resendService";
import prisma from "../db";

// Cache settings to avoid DB query on every email
let cachedSettings: { organizationName: string; primaryColor: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Get tenant branding for email templates
 */
const getTenantBranding = async (): Promise<{ orgName: string; primaryColor: string }> => {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return { orgName: cachedSettings.organizationName, primaryColor: cachedSettings.primaryColor };
  }
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
    if (settings) {
      cachedSettings = { organizationName: settings.organizationName, primaryColor: settings.primaryColor };
      cacheTimestamp = now;
      return { orgName: settings.organizationName, primaryColor: settings.primaryColor };
    }
  } catch {
    // Fall through to defaults
  }
  return { orgName: "Grievance Management System", primaryColor: "#2563eb" };
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

// Email templates — use dynamic branding from TenantSettings
export const emailTemplates = {
  newTicketAssigned: async (reviewerName: string, submitterName: string, ticketSubject: string, ticketId: string) => {
    const { orgName, primaryColor } = await getTenantBranding();
    return {
      subject: `New Grievance Assigned: ${ticketSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${primaryColor};">New Grievance Assigned</h2>
          <p>Dear ${reviewerName},</p>
          <p>A new grievance has been submitted and assigned to you for review:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Submitter:</strong> ${submitterName}</p>
            <p><strong>Subject:</strong> ${ticketSubject}</p>
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
          </div>
          <p>Please review this grievance at your earliest convenience.</p>
          <p style="margin-top: 30px;">Best regards,<br>${orgName}</p>
        </div>
      `,
    };
  },

  /** Sent to the student/submitter immediately after they file a grievance */
  ticketSubmissionConfirmation: async (
    submitterName: string,
    ticketSubject: string,
    ticketId: string
  ) => {
    const { orgName, primaryColor } = await getTenantBranding();
    const baseUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
      "http://localhost:3000";
    const ticketUrl = `${baseUrl.replace(/\/$/, "")}/ticket/${ticketId}`;

    return {
      subject: `We received your grievance: ${ticketSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${primaryColor};">Submission confirmed</h2>
          <p>Dear ${submitterName},</p>
          <p>Thank you for contacting <strong>${orgName}</strong>. Your grievance has been received and logged in our system.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Subject:</strong> ${ticketSubject}</p>
            <p><strong>Reference ID:</strong> ${ticketId}</p>
          </div>
          <p>Your case will be reviewed by the appropriate staff member. You will receive email updates when the status changes.</p>
          <p style="margin: 20px 0;">
            <a href="${ticketUrl}" style="color: ${primaryColor};">View your grievance in the portal</a>
          </p>
          <p style="margin-top: 30px;">Best regards,<br>${orgName}</p>
        </div>
      `,
    };
  },

  ticketStatusUpdate: async (submitterName: string, ticketSubject: string, newStatus: string, comment?: string) => {
    const { orgName, primaryColor } = await getTenantBranding();
    const statusMessages: Record<string, string> = {
      under_review: "is now under review",
      forwarded_to_hod: "has been forwarded to the next reviewer",
      forwarded_to_registrar: "has been forwarded to the final reviewer",
      resolved: "has been resolved",
      rejected: "has been rejected",
    };

    const message = statusMessages[newStatus] || "status has been updated";

    return {
      subject: `Grievance Status Update: ${ticketSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${primaryColor};">Grievance Status Update</h2>
          <p>Dear ${submitterName},</p>
          <p>Your grievance "${ticketSubject}" ${message}.</p>
          ${comment ? `<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;"><p><strong>Comment:</strong> ${comment}</p></div>` : ""}
          <p>You can check the status of your grievance in the dashboard.</p>
          <p style="margin-top: 30px;">Best regards,<br>${orgName}</p>
        </div>
      `,
    };
  },

  nextReviewerAlert: async (reviewerName: string, submitterName: string, ticketSubject: string, ticketId: string, currentLevel: string) => {
    const { orgName, primaryColor } = await getTenantBranding();
    return {
      subject: `Grievance Forwarded for Review: ${ticketSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${primaryColor};">Grievance Forwarded for Review</h2>
          <p>Dear ${reviewerName},</p>
          <p>A grievance has been forwarded to you for review:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Submitter:</strong> ${submitterName}</p>
            <p><strong>Subject:</strong> ${ticketSubject}</p>
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
          </div>
          <p>Please review this grievance and take appropriate action.</p>
          <p style="margin-top: 30px;">Best regards,<br>${orgName}</p>
        </div>
      `,
    };
  },

  emailVerification: async (userName: string, verificationToken: string, userEmail?: string) => {
    const { orgName, primaryColor } = await getTenantBranding();
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3000";
    const emailQuery = userEmail ? `&email=${encodeURIComponent(userEmail)}` : "";
    const verificationUrl = `${baseUrl.replace(/\/$/, "")}/verify-email?token=${verificationToken}${emailQuery}`;

    return {
      subject: `Verify Your Email Address - ${orgName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: ${primaryColor};">Verify Your Email Address</h2>
          <p>Dear ${userName},</p>
          <p>Thank you for registering with ${orgName}. Please verify your email address to complete your registration.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: ${primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
          <p style="margin-top: 30px;">Best regards,<br>${orgName}</p>
        </div>
      `,
    };
  },

  passwordReset: async (userName: string, resetToken: string) => {
    const { orgName, primaryColor } = await getTenantBranding();
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    return {
      subject: `Reset Your Password - ${orgName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: ${primaryColor};">Reset Your Password</h2>
          <p>Dear ${userName},</p>
          <p>We received a request to reset your password for your ${orgName} account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: ${primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; word-break: break-all;">${resetUrl}</p>
          <p style="color: #dc2626; font-size: 14px; margin-top: 20px;"><strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
          <p style="margin-top: 30px;">Best regards,<br>${orgName}</p>
        </div>
      `,
    };
  },
};

/**
 * Check email service configuration status
 */
export const checkEmailConfiguration = () => {
  const resendConfigured = isResendConfigured();
  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  const config = {
    provider: resendConfigured ? "Resend" : smtpConfigured ? "SMTP" : "None",
    resendApiKey: process.env.RESEND_API_KEY ? "✅ SET" : "❌ NOT SET",
    resendFromEmail: process.env.RESEND_FROM_EMAIL || "Using default",
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: process.env.SMTP_PORT || "587",
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS ? "***" : undefined,
    smtpFrom: process.env.SMTP_FROM,
    isConfigured: resendConfigured || smtpConfigured,
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
