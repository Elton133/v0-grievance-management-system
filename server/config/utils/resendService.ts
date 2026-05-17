import { Resend } from "resend";
import prisma from "../db";

// Initialize Resend client
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

/**
 * Get the organization name from TenantSettings for email branding
 */
const getFromName = async (): Promise<string> => {
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
    return settings?.organizationName || process.env.RESEND_FROM_NAME || "Grievance Management System";
  } catch {
    return process.env.RESEND_FROM_NAME || "Grievance Management System";
  }
};

/**
 * Send email using Resend
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - Email HTML content
 * @returns Promise<boolean> - true if sent successfully
 */
export const sendEmailViaResend = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  if (!resend) {
    console.error("[Resend] ❌ RESEND_API_KEY not configured");
    return false;
  }

  try {
    const fromName = await getFromName();
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    });

    if (error) {
      const detail =
        typeof error === "object" && error !== null && Object.keys(error as object).length > 0
          ? JSON.stringify(error, null, 2)
          : String(error);
      console.error("[Resend] ❌ Error sending email:", detail);
      return false;
    }

    console.log("[Resend] ✅ Email sent successfully:", data?.id);
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Resend] ❌ Exception sending email:", msg, error);
    return false;
  }
};

/**
 * Check if Resend is configured
 */
export const isResendConfigured = (): boolean => {
  return !!process.env.RESEND_API_KEY;
};
