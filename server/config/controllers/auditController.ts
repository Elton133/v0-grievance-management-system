import { Response } from "express";
import prisma from "../db";
import { AuthRequest } from "../middleware/auth";
import { formatWorkflowRole } from "../utils/workflowLabels";
import { statusKeyToLabel } from "../utils/auditService";

function formatAuditDetails(action: string, details: unknown): string {
  if (details == null) return "";
  if (typeof details === "string") return details;
  if (typeof details !== "object") return String(details);

  const d = details as Record<string, unknown>;

  if (typeof d.summary === "string" && d.summary.trim()) {
    return d.summary;
  }

  if (action === "ticket.status_changed") {
    const prev = d.previousStatus ? statusKeyToLabel(String(d.previousStatus)) : "";
    const next = d.newStatus ? statusKeyToLabel(String(d.newStatus)) : "";
    const comment = typeof d.comment === "string" ? d.comment.trim() : "";
    let text = prev && next ? `${prev} → ${next}` : next || prev;
    if (comment) text += ` — ${comment}`;
    if (d.assignedToName) text += ` (assigned to ${d.assignedToName})`;
    return text;
  }

  if (action === "ticket.created") {
    const subject = d.subject ? String(d.subject) : "";
    return subject ? `New petition submitted: ${subject}` : "New petition submitted";
  }

  if (action === "ticket.comment_added" && typeof d.preview === "string") {
    return d.preview;
  }

  if (action === "ticket.assigned" && d.assignedToName) {
    return `Assigned to ${d.assignedToName}`;
  }

  if (action === "ticket.deleted" && d.subject) {
    return `Petition deleted: ${d.subject}`;
  }

  try {
    return JSON.stringify(d);
  } catch {
    return "";
  }
}

const ACTION_DISPLAY: Record<string, string> = {
  "ticket.created": "PETITION_SUBMITTED",
  "ticket.status_changed": "STATUS_UPDATE",
  "ticket.assigned": "PETITION_ASSIGNED",
  "ticket.comment_added": "COMMENT_ADDED",
  "ticket.updated": "PETITION_UPDATED",
  "ticket.deleted": "PETITION_DELETED",
  "ticket.attachment_added": "ATTACHMENT_ADDED",
};

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { id: "default" },
      select: { rolesConfig: true },
    });
    const roles = Array.isArray(settings?.rolesConfig) ? (settings.rolesConfig as any[]) : [];
    const submitterRole = roles.find((r) => r.isSubmitter)?.key ?? "student";
    if (user.role === submitterRole || user.role === "student" || user.role === "submitter") {
      return res.status(403).json({ error: "Staff access required" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const skip = (page - 1) * limit;

    const [total, rows] = await prisma.$transaction([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
    ]);

    const ticketIds = rows
      .filter((r) => r.resourceType === "ticket" && r.resourceId)
      .map((r) => r.resourceId as string);

    const tickets =
      ticketIds.length > 0
        ? await prisma.ticket.findMany({
            where: { id: { in: ticketIds } },
            select: { id: true, referenceCode: true },
          })
        : [];

    const refById = new Map(tickets.map((t) => [t.id, t.referenceCode]));

    const data = rows.map((row) => {
      const ticketUuid =
        row.resourceType === "ticket" && row.resourceId ? row.resourceId : undefined;
      const referenceCode = ticketUuid ? refById.get(ticketUuid) : undefined;

      return {
        id: row.id,
        timestamp: row.createdAt,
        userId: row.userName || row.userId || "System",
        userRole: row.userRole ? formatWorkflowRole(row.userRole) : "",
        action: ACTION_DISPLAY[row.action] ?? row.action.replace(/\./g, "_").toUpperCase(),
        ticketId: referenceCode || ticketUuid,
        ticketUuid,
        details: formatAuditDetails(row.action, row.details),
        ipAddress: row.ipAddress ?? undefined,
      };
    });

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error("[AuditController] getAuditLogs:", err);
    res.status(500).json({ error: "Server error" });
  }
};
