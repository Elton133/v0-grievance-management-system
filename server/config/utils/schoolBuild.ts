import type { Response } from "express"

/**
 * School / thesis deployment: fixed org config, no tenant self-service.
 * Set SCHOOL_BUILD=true on the API server. Pair with NEXT_PUBLIC_SCHOOL_BUILD=true on the Next app.
 */
export function isSchoolBuild(): boolean {
  const v = process.env.SCHOOL_BUILD?.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes"
}

export function schoolBuildSettingsForbidden(res: Response) {
  return res.status(403).json({
    error: "Organization settings are disabled in this deployment (school build).",
  })
}

export function schoolBuildDeveloperForbidden(res: Response) {
  return res.status(403).json({
    error: "Developer integrations are disabled in this deployment (school build).",
  })
}
