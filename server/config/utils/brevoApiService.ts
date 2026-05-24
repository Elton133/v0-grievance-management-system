import axios from "axios";

export const isBrevoApiConfigured = (): boolean =>
  !!(process.env.BREVO_API_KEY?.trim());

function parseSender(): { name: string; email: string } {
  const raw = process.env.MAIL_FROM?.trim() ?? "";
  const match = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim() || "Grievance Portal", email: match[2].trim() };
  if (raw.includes("@")) return { name: "Grievance Portal", email: raw };
  return { name: "Grievance Portal", email: process.env.BREVO_SMTP_USER?.trim() ?? "noreply@example.com" };
}

export const sendEmailViaBrevoApi = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    console.error("[Brevo API] ❌ BREVO_API_KEY not configured");
    return false;
  }

  const sender = parseSender();
  const start = Date.now();

  try {
    const { data } = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      { sender, to: [{ email: to }], subject, htmlContent: html },
      {
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        timeout: 15000,
      }
    );
    console.log(`[Brevo API] ✅ Sent (${Date.now() - start}ms) ID: ${data?.messageId ?? "N/A"}`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const detail = (err as any)?.response?.data;
    console.error(`[Brevo API] ❌ Error (${Date.now() - start}ms):`, msg, detail ?? "");
    return false;
  }
};
