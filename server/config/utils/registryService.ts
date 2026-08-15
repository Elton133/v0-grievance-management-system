import { Prisma } from "@prisma/client"
import prisma from "../db"
import { departmentsEquivalentForRoster } from "./departmentRosterMatch"

/** Registry tables not migrated yet (run `npx prisma db push`). */
export function isRegistrySchemaMissing(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2010")
  )
}

export type RegistryRow = {
  memberType: string
  studentId: string
  fullName: string
  department: string
  email?: string | null
  level?: string | null
}

export async function registryHasEntries(organizationId: string): Promise<boolean> {
  try {
    const count = await prisma.registryStudent.count({ where: { organizationId } })
    return count > 0
  } catch (err) {
    if (isRegistrySchemaMissing(err)) return false
    throw err
  }
}

export async function validateAgainstRegistry(
  organizationId: string,
  memberType: string,
  fullName: string,
  studentId: string,
  department?: string
): Promise<{ ok: true } | { ok: false; message: string; path: string }> {
  const hasDb = await registryHasEntries(organizationId)
  if (!hasDb) return { ok: true }

  const sid = studentId.trim().toUpperCase()
  let row: Awaited<ReturnType<typeof prisma.registryStudent.findUnique>>
  try {
    row = await prisma.registryStudent.findUnique({
      where: { organizationId_studentId: { organizationId, studentId: sid } },
    })
  } catch (err) {
    if (isRegistrySchemaMissing(err)) return { ok: true }
    throw err
  }

  if (!row) {
    return {
      ok: false,
      message: "This ID is not on the school registry. Contact the registrar if you believe this is an error.",
      path: "submitterId",
    }
  }

  if (row.memberType !== memberType) {
    return {
      ok: false,
      message: `This ID is registered as ${row.memberType}, not ${memberType}.`,
      path: "submitterId",
    }
  }

  const nameOk =
    row.fullName.trim().toLowerCase() === fullName.trim().toLowerCase()
  if (!nameOk) {
    return {
      ok: false,
      message: "Name does not match the registry record for this ID.",
      path: "name",
    }
  }

  if (department?.trim()) {
    const deptOk =
      departmentsEquivalentForRoster(row.department, department) ||
      row.department.trim().toLowerCase() === department.trim().toLowerCase()
    if (!deptOk) {
      return {
        ok: false,
        message: "Department does not match the registry record for this ID.",
        path: "group",
      }
    }
  }

  return { ok: true }
}

export function parseRegistryCsv(text: string): RegistryRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const idx = (names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1

  const typeIdx = idx(["membertype", "member_type", "type", "role"])
  const idIdx = idx(["studentid", "student_id", "id"])
  const nameIdx = idx(["fullname", "full_name", "name"])
  const deptIdx = idx(["department", "dept", "group"])
  const emailIdx = idx(["email"])
  const levelIdx = idx(["level", "year"])

  const start = typeIdx >= 0 || nameIdx >= 0 ? 1 : 0
  const rows: RegistryRow[] = []

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim())
    const studentId = (cols[idIdx >= 0 ? idIdx : 1] ?? "").toUpperCase()
    const fullName = cols[nameIdx >= 0 ? nameIdx : 2] ?? ""
    const department = cols[deptIdx >= 0 ? deptIdx : 3] ?? ""
    const memberType = (cols[typeIdx >= 0 ? typeIdx : 0] ?? "student").toLowerCase()
    if (!studentId || !fullName || !department) continue
    rows.push({
      memberType: memberType === "alumni" ? "alumni" : "student",
      studentId,
      fullName,
      department,
      email: emailIdx >= 0 ? cols[emailIdx] || null : null,
      level: levelIdx >= 0 ? cols[levelIdx] || null : null,
    })
  }
  return rows
}
