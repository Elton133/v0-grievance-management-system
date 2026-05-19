import type { Request } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../db";

export type AuditAction =
  | "ticket.created"
  | "ticket.assigned"
  | "ticket.status_changed"
  | "ticket.comment_added"
  | "ticket.updated"
  | "ticket.deleted"
  | "ticket.attachment_added";

type RecordAuditParams = {
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: AuditAction | string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  req?: Request;
};

export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  try {
    const ip =
      (params.req?.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      params.req?.socket?.remoteAddress ||
      null;
    const userAgent = (params.req?.headers["user-agent"] as string) || null;

    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        userName: params.userName ?? null,
        userRole: params.userRole ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        details:
          params.details == null
            ? undefined
            : (params.details as Prisma.InputJsonValue),
        ipAddress: ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[AuditService] Failed to record audit log:", err);
  }
}

/** Human-readable status label from tenant keys */
export function statusKeyToLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function describeStatusChange(
  previousStatus: string | null | undefined,
  newStatus: string
): string {
  if (!previousStatus) {
    return `Petition submitted`;
  }
  const from = statusKeyToLabel(previousStatus);
  const to = statusKeyToLabel(newStatus);
  if (newStatus === "rejected") return `Rejected (was ${from})`;
  if (newStatus === "resolved") return `Resolved (was ${from})`;
  if (newStatus === "forwarded_to_hod") return `Forwarded to Head of Department`;
  if (newStatus === "forwarded_to_registrar") return `Forwarded to Registrar`;
  if (newStatus === "under_review") return `Review started`;
  return `Status changed: ${from} → ${to}`;
}
