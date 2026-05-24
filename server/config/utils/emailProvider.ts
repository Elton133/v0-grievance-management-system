import { isResendConfigured } from "./resendService"
import { isBrevoApiConfigured } from "./brevoApiService"

export type EmailProvider = "smtp" | "brevo" | "brevo-api" | "sendgrid" | "resend"

const PROVIDERS: EmailProvider[] = ["smtp", "brevo", "brevo-api", "sendgrid", "resend"]

export function isSmtpCredentialsConfigured(): boolean {
  return !!(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim())
}

export function isBrevoConfigured(): boolean {
  return !!(process.env.BREVO_SMTP_KEY?.trim() && process.env.BREVO_SMTP_USER?.trim())
}

export function isSendgridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY?.trim()
}

/** Resolved From header for outbound mail (provider-specific env vars fall back to MAIL_FROM). */
export function getMailFromAddress(): string {
  const mailFrom = process.env.MAIL_FROM?.trim()
  if (mailFrom) return mailFrom

  if (getActiveEmailProvider() === "resend") {
    const name = process.env.RESEND_FROM_NAME || "Grievance Management System"
    const email = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
    return `${name} <${email}>`
  }

  if (process.env.SMTP_FROM?.trim()) return process.env.SMTP_FROM.trim()

  const smtpUser = process.env.SMTP_USER?.trim()
  if (smtpUser) return `"Grievance Management System" <${smtpUser}>`

  // BREVO_SMTP_USER is the SMTP login (often *@smtp-brevo.com), NOT the verified sender.
  // Set MAIL_FROM to your verified sender in Brevo (e.g. your Gmail).

  return '"Grievance Management System" <noreply@example.com>'
}

/**
 * Which provider sends mail. Set EMAIL_PROVIDER explicitly (recommended for demos).
 * If unset: first configured provider in order brevo → sendgrid → smtp → resend.
 */
export function getActiveEmailProvider(): EmailProvider | null {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  if (explicit && PROVIDERS.includes(explicit as EmailProvider)) {
    const p = explicit as EmailProvider
    if (isProviderConfigured(p)) return p
    return null
  }

  if (isBrevoApiConfigured()) return "brevo-api"
  if (isBrevoConfigured()) return "brevo"
  if (isSendgridConfigured()) return "sendgrid"
  if (isSmtpCredentialsConfigured()) return "smtp"
  if (isResendConfigured()) return "resend"
  return null
}

export function isProviderConfigured(provider: EmailProvider): boolean {
  switch (provider) {
    case "brevo-api":
      return isBrevoApiConfigured()
    case "brevo":
      return isBrevoConfigured()
    case "sendgrid":
      return isSendgridConfigured()
    case "smtp":
      return isSmtpCredentialsConfigured()
    case "resend":
      return isResendConfigured()
    default:
      return false
  }
}

export function isEmailSendingConfigured(): boolean {
  return getActiveEmailProvider() !== null
}

export function getEmailProviderLabel(provider: EmailProvider): string {
  switch (provider) {
    case "brevo-api":
      return "Brevo (API)"
    case "brevo":
      return "Brevo (SMTP)"
    case "sendgrid":
      return "SendGrid (SMTP)"
    case "smtp":
      return "SMTP"
    case "resend":
      return "Resend"
    default:
      return provider
  }
}

export type SmtpTransportConfig = {
  host: string
  port: number
  secure: boolean
  auth: { user: string; pass: string }
}

/** SMTP connection settings for nodemailer based on active provider. */
export function getSmtpTransportConfig(): SmtpTransportConfig | null {
  const provider = getActiveEmailProvider()
  if (!provider || provider === "resend") return null

  if (provider === "brevo") {
    if (!isBrevoConfigured()) return null
    const port = parseInt(process.env.BREVO_SMTP_PORT || "587", 10)
    return {
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port,
      secure: port === 465,
      auth: {
        user: process.env.BREVO_SMTP_USER!.trim(),
        pass: process.env.BREVO_SMTP_KEY!.trim(),
      },
    }
  }

  if (provider === "sendgrid") {
    if (!isSendgridConfigured()) return null
    return {
      host: process.env.SENDGRID_SMTP_HOST || "smtp.sendgrid.net",
      port: parseInt(process.env.SENDGRID_SMTP_PORT || "587", 10),
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY!.trim(),
      },
    }
  }

  // generic smtp
  if (!isSmtpCredentialsConfigured()) return null
  const host = process.env.SMTP_HOST || "smtp.gmail.com"
  const port = parseInt(process.env.SMTP_PORT || "587", 10)
  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!.trim(),
    },
  }
}

export function getEmailConfigurationSummary() {
  const active = getActiveEmailProvider()
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || null

  return {
    provider: active ? getEmailProviderLabel(active) : "None",
    providerKey: active,
    explicitProvider: explicit,
    from: getMailFromAddress(),
    isConfigured: isEmailSendingConfigured(),
    brevo: isBrevoConfigured(),
    sendgrid: isSendgridConfigured(),
    smtp: isSmtpCredentialsConfigured(),
    resend: isResendConfigured(),
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION !== "false",
  }
}
