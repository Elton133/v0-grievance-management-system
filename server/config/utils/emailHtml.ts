/**
 * Shared HTML email layout: fonts, logo header, footer, escaping.
 * Uses tables + inline CSS for broad client support; web fonts load where supported (Gmail, Apple Mail, etc.).
 */

export type EmailBranding = {
  orgName: string
  primaryColor: string
  accentColor: string
  /** Absolute URL for <img src>, or null to omit */
  logoAbsoluteUrl: string | null
  supportEmail: string | null
}

const FONT_SANS =
  "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const FONT_SERIF = "'Literata', 'Georgia', 'Times New Roman', serif"

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Public base for resolving relative logo paths from TenantSettings (e.g. /logo.png). */
export function getPublicSiteBaseUrl(): string {
  const raw =
    process.env.FRONTEND_URL?.trim() ||
    process.env.EMAIL_ASSET_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/i, "").trim() ||
    ""
  return raw.replace(/\/$/, "")
}

/** Turn stored logoUrl into an absolute URL for email clients; returns null if not usable. */
export function resolveLogoUrlForEmail(logoUrl: string | null | undefined): string | null {
  if (!logoUrl?.trim()) return null
  const u = logoUrl.trim()
  if (/^https?:\/\//i.test(u)) return u
  const base = getPublicSiteBaseUrl()
  if (!base) return null
  if (u.startsWith("/")) return `${base}${u}`
  return `${base}/${u}`
}

function fontLinkTags(): string {
  return `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap" rel="stylesheet" />
  `.trim()
}

export type BrandedEmailOptions = {
  branding: EmailBranding
  /** Short hidden preview line (some clients show next to subject) */
  preheader?: string
  /** Main title inside the card */
  headline: string
  /** Inner HTML (already safe or built with escapeHtml) */
  bodyHtml: string
  /** Optional extra rows in the info footer (HTML snippets) */
  extraFooterRows?: string
}

/**
 * Full HTML document with header band, logo, body, and institutional footer.
 */
export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const { branding, preheader, headline, bodyHtml, extraFooterRows } = opts
  const year = new Date().getFullYear()
  const portalBase = getPublicSiteBaseUrl()
  const portalLink = portalBase
    ? `<a href="${escapeHtml(portalBase)}" style="color:${branding.primaryColor};font-weight:600;text-decoration:none;">Open grievance portal</a>`
    : ""

  const supportBlock =
    branding.supportEmail?.trim() ?
      `<p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.5;">
        <strong style="color:#334155;">Support</strong><br />
        <a href="mailto:${escapeHtml(branding.supportEmail.trim())}" style="color:${branding.primaryColor};text-decoration:none;">${escapeHtml(branding.supportEmail.trim())}</a>
      </p>`
    : ""

  const preheaderHidden =
    preheader ?
      `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">
        ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>`
    : ""

  const logoBlock =
    branding.logoAbsoluteUrl ?
      `<img src="${escapeHtml(branding.logoAbsoluteUrl)}" alt="${escapeHtml(branding.orgName)}" width="160" style="max-width:160px;height:auto;display:block;margin:0 auto;border:0;outline:none;" />`
    : `<p style="margin:0;font-family:${FONT_SERIF};font-size:22px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">${escapeHtml(branding.orgName)}</p>`

  const subline =
    branding.logoAbsoluteUrl ?
      `<p style="margin:14px 0 0;font-family:${FONT_SANS};font-size:13px;font-weight:500;color:rgba(255,255,255,0.92);letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(branding.orgName)}</p>`
    : `<p style="margin:10px 0 0;font-family:${FONT_SANS};font-size:13px;font-weight:500;color:rgba(255,255,255,0.88);">Grievance &amp; student support</p>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(headline)}</title>
  ${fontLinkTags()}
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-font-smoothing:antialiased;">
  ${preheaderHidden}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
          <tr>
            <td style="background-color:${branding.primaryColor};padding:32px 28px;text-align:center;border-bottom:4px solid ${branding.accentColor};">
              ${logoBlock}
              ${subline}
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;font-family:${FONT_SANS};font-size:16px;line-height:1.6;color:#334155;">
              <h1 style="margin:0 0 20px;font-family:${FONT_SERIF};font-size:24px;font-weight:600;line-height:1.25;color:#0f172a;letter-spacing:-0.02em;">${escapeHtml(headline)}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;font-family:${FONT_SANS};font-size:15px;line-height:1.6;color:#475569;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">About this message</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.55;">
                      This email was sent by <strong style="color:#334155;">${escapeHtml(branding.orgName)}</strong> through the grievance management system.
                      Please do not reply to automated notices unless a support address is shown below.
                    </p>
                    ${supportBlock}
                    ${portalLink ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;line-height:1.5;">${portalLink}</p>` : ""}
                    ${extraFooterRows ?? ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;font-family:${FONT_SANS};font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;">
              © ${year} ${escapeHtml(branding.orgName)}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Primary CTA button */
export function emailButton(href: string, label: string, primaryColor: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">
    <tr>
      <td align="center" style="border-radius:10px;background-color:${primaryColor};">
        <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT_SANS};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`.trim()
}

/** Muted detail card */
export function emailDetailCard(rows: Array<{ label: string; value: string }>): string {
  const inner = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:8px 0;font-family:${FONT_SANS};font-size:12px;font-weight:600;color:#64748b;width:120px;vertical-align:top;">${escapeHtml(r.label)}</td>
      <td style="padding:8px 0;font-family:${FONT_SANS};font-size:14px;color:#0f172a;vertical-align:top;">${escapeHtml(r.value)}</td>
    </tr>`
    )
    .join("")
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin:20px 0;">
    <tr><td style="padding:18px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${inner}</table>
    </td></tr>
  </table>`.trim()
}
