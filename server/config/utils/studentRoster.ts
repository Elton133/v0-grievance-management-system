import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { departmentsEquivalentForRoster } from "./departmentRosterMatch"

export type StudentRosterRow = {
  fullName: string
  studentId: string
  /** If set, chosen department on the form must match (case-insensitive). */
  department?: string
}

let cachedRows: StudentRosterRow[] | null = null
let cachedPath: string | null = null

function rosterFilePath(): string {
  const fromEnv = process.env.STUDENT_ROSTER_PATH?.trim()
  if (fromEnv) return fromEnv
  // Assumes process.cwd() is the `server` folder when the API runs (see package.json scripts).
  return join(process.cwd(), "config", "data", "studentRoster.json")
}

/**
 * Official enrollment-style list for demo / school validation.
 * Empty array or missing file = roster checks disabled.
 */
export function loadStudentRoster(): StudentRosterRow[] {
  const path = rosterFilePath()
  if (cachedRows !== null && cachedPath === path) return cachedRows
  cachedPath = path
  if (!existsSync(path)) {
    cachedRows = []
    return cachedRows
  }
  try {
    const raw = readFileSync(path, "utf8")
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      cachedRows = []
      return cachedRows
    }
    const rows: StudentRosterRow[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue
      const o = item as Record<string, unknown>
      const fullName = typeof o.fullName === "string" ? o.fullName.trim() : ""
      const studentId = typeof o.studentId === "string" ? o.studentId.trim() : ""
      if (!fullName || !studentId) continue
      const department = typeof o.department === "string" ? o.department.trim() : undefined
      rows.push({ fullName, studentId, department: department || undefined })
    }
    cachedRows = rows
  } catch {
    cachedRows = []
  }
  return cachedRows
}

export function rosterValidationEnabled(): boolean {
  return loadStudentRoster().length > 0
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

function normId(s: string): string {
  return s.trim().toUpperCase()
}

function normDept(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

export type RosterValidationIssue = {
  path: "name" | "submitterId" | "group"
  message: string
}

/**
 * When the roster has at least one row, student registration must match
 * a row by Student ID, full name, and optional department.
 */
export function validateStudentAgainstRoster(
  fullName: string,
  studentId: string,
  department: string | undefined
): RosterValidationIssue | null {
  const rows = loadStudentRoster()
  if (rows.length === 0) return null

  const sid = normId(studentId)
  const nameIn = normName(fullName)
  const deptIn = normDept(department)

  const byId = rows.filter((r) => normId(r.studentId) === sid)
  if (byId.length === 0) {
    return {
      path: "submitterId",
      message: "This Student ID is not on the school enrollment list. Contact the registrar if you believe this is an error.",
    }
  }

  const row = byId[0]
  if (normName(row.fullName) !== nameIn) {
    return {
      path: "name",
      message: "Full name does not match the school record for this Student ID. Use your official name as on the class list.",
    }
  }

  if (row.department && deptIn && !departmentsEquivalentForRoster(department, row.department)) {
    return {
      path: "group",
      message: `Department must match the school record for this Student ID (recorded as "${row.department}" — labels like ICT and Information Technology are treated as the same).`,
    }
  }

  if (row.department && !deptIn) {
    return {
      path: "group",
      message: `Select the department on file for this Student ID (${row.department}).`,
    }
  }

  return null
}

/** Clear cache after tests or hot-reload of JSON in dev */
export function clearStudentRosterCache(): void {
  cachedRows = null
  cachedPath = null
}
