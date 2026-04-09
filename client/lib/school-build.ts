/**
 * School / thesis UI: hide tenant settings & developer pages.
 * Must match server `SCHOOL_BUILD` for a consistent deployment.
 */
export function isSchoolBuild(): boolean {
  if (typeof process === "undefined") return false
  const v = process.env.NEXT_PUBLIC_SCHOOL_BUILD?.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes"
}
