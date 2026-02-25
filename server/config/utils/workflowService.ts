import prisma from "../db";

/**
 * Workflow Service - Handles grievance escalation and auto-assignment logic
 * 
 * Now reads escalation hierarchy from TenantSettings instead of hardcoded values.
 * Falls back to default RMU hierarchy if no settings exist.
 */

// Default escalation hierarchy (fallback)
const DEFAULT_ESCALATION_HIERARCHY: Record<number, string> = {
  1: "class_advisor",    // Level 1: Class Advisor
  2: "hod",               // Level 2: Head of Group
  3: "registrar",         // Level 3: Registrar
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

/**
 * Get the escalation hierarchy from TenantSettings or use defaults
 */
const getEscalationHierarchy = async (): Promise<Record<number, string>> => {
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
    if (settings && Array.isArray(settings.rolesConfig)) {
      const roles = settings.rolesConfig as Array<{ key: string; label: string; level: number; isSubmitter?: boolean }>;
      // Build hierarchy from roles where level > 0 (non-submitter roles)
      const hierarchy: Record<number, string> = {};
      roles
        .filter(r => !r.isSubmitter && r.level > 0)
        .sort((a, b) => a.level - b.level)
        .forEach(r => {
          hierarchy[r.level] = r.key;
        });
      
      if (Object.keys(hierarchy).length > 0) {
        return hierarchy;
      }
    }
  } catch (error) {
    console.warn("[WorkflowService] Could not load escalation hierarchy from settings, using defaults");
  }
  return DEFAULT_ESCALATION_HIERARCHY;
};

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
  const hierarchy = await getEscalationHierarchy();
  const targetRole = hierarchy[escalationLevel];
  if (!targetRole) {
    return null;
  }

  try {
    // Find a user with the target role
    // If group is specified, filter users by that group (for group-scoped roles)
    const whereClause: any = { role: targetRole };
    
    // Get settings to determine which roles are group-scoped
    const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
    const roles = (settings?.rolesConfig as Array<{ key: string; groupScoped?: boolean }>) || [];
    const roleConfig = roles.find(r => r.key === targetRole);
    
    // If role is group-scoped (or if it's a known group-scoped role), filter by group
    const isDeptScoped = roleConfig?.groupScoped !== false; // Default to true for backward compat
    if (group && isDeptScoped && targetRole !== "registrar") {
      whereClause.group = group;
    }

    const reviewer = await prisma.user.findFirst({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!reviewer) {
      console.warn(`No ${targetRole} found for escalation level ${escalationLevel}`);
      return null;
    }

    return {
      userId: reviewer.id,
      userEmail: reviewer.email,
      userName: reviewer.name,
    };
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
