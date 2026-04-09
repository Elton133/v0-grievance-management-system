import prisma from "../db";

/**
 * Workflow Service - Handles grievance escalation and auto-assignment logic
 * 
 * Now reads escalation hierarchy from TenantSettings instead of hardcoded values.
 * Falls back to default RMU hierarchy if no settings exist.
 */

// Default escalation hierarchy (fallback)
const DEFAULT_ESCALATION_HIERARCHY: Record<number, string> = {
  1: "advisor",
  2: "hod",
  3: "registrar",
};

// Default status progression map (fallback)
const DEFAULT_STATUS_PROGRESSION: Record<string, string[]> = {
  submitted: ["under_review", "rejected"],
  under_review: ["forwarded_to_hod", "resolved", "rejected"],
  forwarded_to_hod: ["forwarded_to_registrar", "resolved", "rejected"],
  forwarded_to_registrar: ["resolved", "rejected"],
  resolved: [],
  rejected: [],
};

type RoleConfigRow = {
  key: string;
  level: number;
  isSubmitter?: boolean;
  groupScoped?: boolean;
};

function parseRolesConfig(raw: unknown): RoleConfigRow[] {
  if (Array.isArray(raw)) return raw as RoleConfigRow[];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? (p as RoleConfigRow[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Levels from the UI/JSON may be strings; sort must be numeric. */
function getReviewersSorted(roles: RoleConfigRow[]): RoleConfigRow[] {
  return roles
    .filter((r) => r.isSubmitter !== true && Number(r.level) > 0)
    .sort((a, b) => Number(a.level) - Number(b.level));
}

/**
 * Ordered role keys to try for this escalation slot (1 = first reviewer in chain).
 * Includes primary slot role, default RMU key for that slot, then every other reviewer role.
 */
function getReviewerRoleCandidatesForSlot(
  reviewersSorted: RoleConfigRow[],
  slot: number
): string[] {
  const candidates: string[] = [];
  const primary = reviewersSorted[slot - 1]?.key;
  if (primary) candidates.push(primary);
  const def = DEFAULT_ESCALATION_HIERARCHY[slot];
  if (def && def !== primary) candidates.push(def);
  for (const r of reviewersSorted) {
    if (r.key && !candidates.includes(r.key)) candidates.push(r.key);
  }
  return candidates;
}

async function findUserForRoleKey(
  targetRole: string,
  group: string | undefined,
  rolesConfig: RoleConfigRow[]
): Promise<{ id: string; email: string; name: string } | null> {
  const roleConfig = rolesConfig.find((r) => r.key === targetRole);
  const isDeptScoped = roleConfig?.groupScoped !== false;
  const normalizedGroup = group?.trim();

  const whereBase: { role: string; group?: string | { equals: string; mode: "insensitive" } } = {
    role: targetRole,
  };

  if (normalizedGroup && isDeptScoped) {
    whereBase.group = { equals: normalizedGroup, mode: "insensitive" };
  }

  let reviewer = await prisma.user.findFirst({
    where: whereBase,
    select: { id: true, email: true, name: true },
  });

  if (!reviewer && normalizedGroup && isDeptScoped) {
    console.warn(
      `[WorkflowService] No ${targetRole} in department "${normalizedGroup}"; trying school-wide ${targetRole}`
    );
    reviewer = await prisma.user.findFirst({
      where: { role: targetRole },
      select: { id: true, email: true, name: true },
    });
  }

  return reviewer;
}

/**
 * Get the status progression map from TenantSettings or use defaults
 */
const getStatusProgression = async (): Promise<Record<string, string[]>> => {
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
    if (settings && Array.isArray(settings.escalationConfig) && (settings.escalationConfig as any[]).length > 0) {
      const config = settings.escalationConfig as Array<{ fromStatus: string; toStatuses: string[] }>;
      const progression: Record<string, string[]> = {};
      config.forEach(c => {
        progression[c.fromStatus] = c.toStatuses;
      });
      return progression;
    }
  } catch (error) {
    console.warn("[WorkflowService] Could not load status progression from settings, using defaults");
  }
  return DEFAULT_STATUS_PROGRESSION;
};

/**
 * Get the next reviewer based on escalation level
 */
export const getNextReviewer = async (
  escalationLevel: number,
  group?: string
): Promise<{ userId: string; userEmail: string; userName: string } | null> => {
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
    const roles = parseRolesConfig(settings?.rolesConfig);
    const reviewersSorted = getReviewersSorted(roles);

    const candidates = getReviewerRoleCandidatesForSlot(reviewersSorted, escalationLevel);
    if (candidates.length === 0) {
      console.warn(
        `[WorkflowService] No reviewer roles in TenantSettings (escalation slot ${escalationLevel}). Add staff roles with level ≥ 1.`
      );
      return null;
    }

    for (let i = 0; i < candidates.length; i++) {
      const targetRole = candidates[i];
      const reviewer = await findUserForRoleKey(targetRole, group, roles);
      if (reviewer) {
        if (i > 0) {
          console.warn(
            `[WorkflowService] Escalation slot ${escalationLevel}: assigned ${targetRole} (no user with primary role "${candidates[0]}")`
          );
        }
        return {
          userId: reviewer.id,
          userEmail: reviewer.email,
          userName: reviewer.name,
        };
      }
    }

    console.warn(
      `[WorkflowService] No user found for escalation slot ${escalationLevel}. Tried roles: ${candidates.join(", ")} (group=${group ?? "n/a"}). Create a staff account whose User.role matches one of these keys.`
    );
    return null;
  } catch (error) {
    console.error("Error finding next reviewer:", error);
    return null;
  }
};

/**
 * Auto-assign ticket to the appropriate reviewer based on escalation level
 */
export const autoAssignTicket = async (
  ticketId: string,
  escalationLevel: number,
  group?: string
): Promise<boolean> => {
  try {
    const reviewer = await getNextReviewer(escalationLevel, group);
    
    if (!reviewer) {
      return false;
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedTo: reviewer.userId,
        escalationLevel,
      },
    });

    return true;
  } catch (error) {
    console.error("Error auto-assigning ticket:", error);
    return false;
  }
};

/**
 * Validate status transition
 */
export const isValidStatusTransition = async (
  currentStatus: string,
  newStatus: string
): Promise<boolean> => {
  const progression = await getStatusProgression();
  const allowedTransitions = progression[currentStatus];
  if (!allowedTransitions) return false;
  return allowedTransitions.includes(newStatus);
};

/**
 * Get the next escalation level based on status
 */
export const getNextEscalationLevel = (status: string): number => {
  // Default mapping — will be made configurable via TenantSettings
  switch (status) {
    case "submitted":
      return 1; // Level 1
    case "under_review":
      return 2; // Level 2
    case "forwarded_to_hod":
      return 3; // Level 3
    case "forwarded_to_registrar":
      return 3; // Already at highest level
    default:
      return 1;
  }
};

/**
 * Determine if status change requires escalation
 */
export const requiresEscalation = (newStatus: string): boolean => {
  return [
    "forwarded_to_hod",
    "forwarded_to_registrar",
  ].includes(newStatus);
};
