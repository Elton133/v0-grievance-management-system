import rosterJson from "./data/studentRoster.json"
import { departmentsEquivalentForRoster } from "./departmentRosterMatch"

/** Browser-side roster for instant feedback — keep in sync with `server/config/data/studentRoster.json`. */

type RolesOnly = { rolesConfig?: { key: string; isSubmitter?: boolean }[] }

export type StudentRosterRow = {
  fullName: string
  studentId: string
  department?: string
}

const rows: StudentRosterRow[] = Array.isArray(rosterJson)
  ? (rosterJson as StudentRosterRow[]).filter(
      (r) => r && typeof r.fullName === "string" && typeof r.studentId === "string"
    )
  : []

export function rosterValidationEnabledClient(): boolean {
  return rows.length > 0
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

export type RosterValidationIssueClient = {
  path: "name" | "submitterId" | "group"
  message: string
}

export function validateStudentAgainstRosterClient(
  fullName: string,
  studentId: string,
  department: string | undefined
): RosterValidationIssueClient | null {
  if (rows.length === 0) return null
  const sid = normId(studentId)
  const nameIn = normName(fullName)
  const deptIn = normDept(department)

  const byId = rows.filter((r) => normId(r.studentId) === sid)
  if (byId.length === 0) {
    return {
      path: "submitterId",
      message:
        "This Student ID is not on the school enrollment list. Contact the registrar if you believe this is an error.",
    }
  }

  const row = byId[0]
  if (normName(row.fullName) !== nameIn) {
    return {
      path: "name",
      message:
        "Full name does not match the school record for this Student ID. Use your official name as on the class list.",
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

/** Live checks: same rules as server when roster JSON is non-empty. */
export function getLiveRosterRegistrationIssues(
  data: { role: string; name: string; submitterId?: string; group?: string },
  settings: RolesOnly
): Partial<Record<"name" | "submitterId" | "group", string>> {
  const submitterKey = (settings.rolesConfig ?? []).find((r) => r.isSubmitter)?.key ?? "student"
  if (data.role !== submitterKey) return {}
  if (!rosterValidationEnabledClient()) return {}
  const sid = data.submitterId?.trim()
  const name = data.name?.trim()
  if (!sid || !name) return {}
  const issue = validateStudentAgainstRosterClient(name, sid, data.group?.trim())
  if (!issue) return {}
  return { [issue.path]: issue.message }
}
