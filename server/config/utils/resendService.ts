import { Resend } from "resend";

// Initialize Resend client
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const FROM_NAME = process.env.RESEND_FROM_NAME || "Grievance Management System";

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
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("[Resend] ❌ Error sending email:", error);
      return false;
    }

    console.log("[Resend] ✅ Email sent successfully:", data?.id);
    return true;
  } catch (error: any) {
    console.error("[Resend] ❌ Exception sending email:", error);
    return false;
  }
};

/**
 * Check if Resend is configured
 */
export const isResendConfigured = (): boolean => {
  return !!process.env.RESEND_API_KEY;
};

