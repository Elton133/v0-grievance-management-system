import prisma from "../db";

const PREFIX = "PET";

/** Format: PET-2024-001 */
export function formatPetitionReference(year: number, sequence: number): string {
  return `${PREFIX}-${year}-${String(sequence).padStart(3, "0")}`;
}

/** Next sequential reference for the calendar year of `at` (default: now). */
export async function allocatePetitionReference(at: Date = new Date()): Promise<string> {
  const year = at.getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const existing = await prisma.ticket.findMany({
    where: {
      submittedAt: { gte: yearStart, lt: yearEnd },
      referenceCode: { not: null },
    },
    select: { referenceCode: true },
    orderBy: { submittedAt: "desc" },
  });

  let maxSeq = 0;
  const pattern = new RegExp(`^${PREFIX}-${year}-(\\d+)$`);
  for (const row of existing) {
    if (!row.referenceCode) continue;
    const m = row.referenceCode.match(pattern);
    if (m) maxSeq = Math.max(maxSeq, Number.parseInt(m[1], 10));
  }

  const totalInYear = await prisma.ticket.count({
    where: { submittedAt: { gte: yearStart, lt: yearEnd } },
  });
  if (totalInYear > maxSeq) maxSeq = totalInYear;

  return formatPetitionReference(year, maxSeq + 1);
}
