import prisma from "../db";
import { Role, PetitionStatus } from "@prisma/client";

/**
 * Workflow Service - Handles grievance escalation and auto-assignment logic
 */

// Define the escalation hierarchy
const ESCALATION_HIERARCHY: Record<number, Role> = {
  1: "class_advisor",    // Level 1: Class Advisor
  2: "hod",               // Level 2: Head of Department
  3: "registrar",         // Level 3: Registrar
};

// Status progression map
const STATUS_PROGRESSION: Record<PetitionStatus, PetitionStatus[]> = {
  submitted: ["under_review", "rejected"],
  under_review: ["forwarded_to_hod", "resolved", "rejected"],
  forwarded_to_hod: ["forwarded_to_registrar", "resolved", "rejected"],
  forwarded_to_registrar: ["resolved", "rejected"],
  resolved: [],
  rejected: [],
};

/**
 * Get the next reviewer based on escalation level
 */
export const getNextReviewer = async (
  escalationLevel: number,
  department?: string
): Promise<{ userId: string; userEmail: string; userName: string } | null> => {
  const targetRole = ESCALATION_HIERARCHY[escalationLevel];
  if (!targetRole) {
    return null;
  }

  try {
    // Find a user with the target role
    // If department is specified, filter users by that department (for class_advisor and hod)
    const whereClause: any = { role: targetRole };
    if (department && (targetRole === "class_advisor" || targetRole === "hod")) {
      whereClause.department = department;
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
 * Auto-assign petition to the appropriate reviewer based on escalation level
 */
export const autoAssignPetition = async (
  petitionId: string,
  escalationLevel: number,
  department?: string
): Promise<boolean> => {
  try {
    const reviewer = await getNextReviewer(escalationLevel, department);
    
    if (!reviewer) {
      return false;
    }

    await prisma.petition.update({
      where: { id: petitionId },
      data: {
        assignedTo: reviewer.userId,
        escalationLevel,
      },
    });

    return true;
  } catch (error) {
    console.error("Error auto-assigning petition:", error);
    return false;
  }
};

/**
 * Validate status transition
 */
export const isValidStatusTransition = (
  currentStatus: PetitionStatus,
  newStatus: PetitionStatus
): boolean => {
  const allowedTransitions = STATUS_PROGRESSION[currentStatus];
  return allowedTransitions.includes(newStatus);
};

/**
 * Get the next escalation level based on status
 */
export const getNextEscalationLevel = (status: PetitionStatus): number => {
  switch (status) {
    case "submitted":
      return 1; // Class Advisor
    case "under_review":
      return 2; // HOD
    case "forwarded_to_hod":
      return 3; // Registrar
    case "forwarded_to_registrar":
      return 3; // Already at highest level
    default:
      return 1;
  }
};

/**
 * Determine if status change requires escalation
 */
export const requiresEscalation = (newStatus: PetitionStatus): boolean => {
  return [
    "forwarded_to_hod",
    "forwarded_to_registrar",
  ].includes(newStatus);
};

