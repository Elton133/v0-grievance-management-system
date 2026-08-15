const RESERVED_SUBDOMAINS = new Set(["www", "app", "api"])

export function getOrganizationSlug(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_ORGANIZATION_SLUG || "default"

  const explicit = new URLSearchParams(window.location.search).get("workspace")?.trim().toLowerCase()
  if (explicit) {
    localStorage.setItem("organization_slug", explicit)
    return explicit
  }

  const configured = process.env.NEXT_PUBLIC_ORGANIZATION_SLUG?.trim().toLowerCase()
  if (configured) return configured

  const parts = window.location.hostname.split(".")
  if (parts.length > 2 && !RESERVED_SUBDOMAINS.has(parts[0])) return parts[0].toLowerCase()

  return localStorage.getItem("organization_slug") || "default"
}

export function organizationHeaders(): Record<string, string> {
  return { "X-Organization-Slug": getOrganizationSlug() }
}
