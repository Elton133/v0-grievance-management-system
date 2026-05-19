/** Plain-language role titles for emails and audit copy */
export const WORKFLOW_ROLE_LABELS: Record<string, string> = {
  student: "Student",
  advisor: "Class Advisor",
  class_advisor: "Class Advisor",
  hod: "Head of Department (HOD)",
  registrar: "Registrar",
};

export function formatWorkflowRole(roleKey: string): string {
  if (!roleKey) return "Staff";
  return (
    WORKFLOW_ROLE_LABELS[roleKey] ??
    roleKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export const PETITION_CHAIN_OF_COMMAND = [
  "Class Advisor — first review and comments",
  "Head of Department (HOD) — department review, comments, and forward",
  "Registrar — final approval or rejection (only the Registrar can close your petition)",
];

export type StudentUpdateCopy = {
  headline: string;
  summary: string;
  nextStep: string;
};

export function getStudentPetitionUpdateCopy(
  newStatus: string,
  actorName: string,
  actorRole: string
): StudentUpdateCopy {
  const role = formatWorkflowRole(actorRole);
  const by = `${role} — ${actorName}`;

  switch (newStatus) {
    case "under_review":
      return {
        headline: "Your petition is under review",
        summary: `${by} has started reviewing your petition.`,
        nextStep:
          "Next: the Class Advisor may forward your petition to the Head of Department, then to the Registrar for a final decision.",
      };
    case "forwarded_to_hod":
      return {
        headline: "Forwarded to Head of Department",
        summary: `${by} completed their review and forwarded your petition to the Head of Department.`,
        nextStep:
          "Next: the HOD will review, add comments, and forward to the Registrar. Only the Registrar can approve or reject your petition.",
      };
    case "forwarded_to_registrar":
      return {
        headline: "With the Registrar for final decision",
        summary: `${by} forwarded your petition to the Registrar for a final decision.`,
        nextStep:
          "The Registrar will approve (resolve) or reject your petition. You will receive another email when that happens.",
      };
    case "resolved":
      return {
        headline: "Petition approved",
        summary: `${by} (Registrar) has resolved your petition.`,
        nextStep: "No further action is required unless the Registrar contacts you separately.",
      };
    case "rejected":
      return {
        headline: "Petition rejected",
        summary: `${by} (Registrar) has rejected your petition.`,
        nextStep: "See the reason in this email and in your portal activity log.",
      };
    default:
      return {
        headline: "Petition updated",
        summary: `${by} updated your petition.`,
        nextStep: "Sign in to the portal to view the full activity log.",
      };
  }
}
