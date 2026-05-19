import { Response } from "express";
import prisma from "../db";
import { AuthRequest } from "../middleware/auth";
import {
  autoAssignTicket,
  isValidStatusTransition,
  getNextEscalationLevel,
  requiresEscalation,
  getNextReviewer,
} from "../utils/workflowService";
import { sendEmail, emailTemplates } from "../utils/emailService";
import { sanitizeInput, sanitizeText } from "../utils/sanitize";
import { dispatchWebhookEvent } from "../utils/webhookService";
import { effectiveGroupPrefixes } from "../utils/defaultGroupPrefixes";
import { recordAuditLog, describeStatusChange } from "../utils/auditService";
import { allocatePetitionReference } from "../utils/petitionReference";
import { uploadFile } from "../utils/supabaseStorage";
import { validateAttachmentMeta } from "../utils/attachmentValidation";

// Create a new ticket
export const createTicket = async (req: AuthRequest, res: Response) => {
  const { subject, description, type, group, year, priority, attachments } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Sanitize inputs
    const sanitizedSubject = sanitizeInput(subject);
    const sanitizedDescription = sanitizeText(description);
    const ticketGroup = group ? sanitizeInput(group) : (user.group || "Unknown");
    const ticketYear = year ? sanitizeInput(year) : "Unknown";

    const referenceCode = await allocatePetitionReference();

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        referenceCode,
        submitterId: req.user.id,
        submitterName: user.name,
        submitterEmail: user.email,
        group: ticketGroup,
        year: ticketYear,
        type,
        subject: sanitizedSubject,
        description: sanitizedDescription,
        priority: priority || "medium",
        status: "submitted",
        escalationLevel: 1, // Start at level 1 (Class Advisor)
      },
    });

    // Create attachments if provided
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      await prisma.ticketAttachment.createMany({
        data: attachments.map((att: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string }) => ({
          ticketId: ticket.id,
          fileName: sanitizeInput(att.fileName),
          fileUrl: att.fileUrl, // URL is already validated from Supabase
          fileSize: att.fileSize || null,
          mimeType: att.mimeType || null,
        })),
      });
    }

    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: ticket.id,
        previousStatus: null,
        newStatus: "submitted",
        changedBy: req.user.id,
        changedByName: user.name,
        changedByRole: user.role,
        comment: null,
      },
    });

    await recordAuditLog({
      userId: req.user.id,
      userName: user.name,
      userRole: user.role,
      action: "ticket.created",
      resourceType: "ticket",
      resourceId: ticket.id,
      details: {
        subject: sanitizedSubject,
        type,
        group: ticketGroup,
        year: ticketYear,
        status: "submitted",
      },
      req,
    });

    // Auto-assign to first reviewer (Class Advisor) - optimized to get reviewer in one query
    const reviewer = await getNextReviewer(1, ticketGroup);
    const assigned = reviewer ? await autoAssignTicket(ticket.id, 1, ticketGroup) : false;

    if (assigned && reviewer) {
      await recordAuditLog({
        userId: req.user.id,
        userName: user.name,
        userRole: user.role,
        action: "ticket.assigned",
        resourceType: "ticket",
        resourceId: ticket.id,
        details: {
          assignedTo: reviewer.userId,
          assignedToName: reviewer.userName,
          assignedToEmail: reviewer.userEmail,
          escalationLevel: 1,
        },
        req,
      });
    }

    // Batch create notifications (non-blocking)
    const notifications = [
      {
        userId: req.user.id,
        ticketId: ticket.id,
        title: "Grievance Submitted",
        message: `Your grievance "${subject}" has been submitted and is awaiting review.`,
        type: "info" as const,
      },
    ];

    if (assigned && reviewer) {
      notifications.push({
        userId: reviewer.userId,
        ticketId: ticket.id,
        title: "New Grievance Assigned",
        message: `A new grievance "${subject}" has been assigned to you for review.`,
        type: "info" as const,
      });
    }

    // Create notifications in parallel (non-blocking for response)
    prisma.notification.createMany({
      data: notifications,
    }).catch(err => console.error("Error creating notifications:", err));

    // Submitter confirmation email (always when ticket is created)
    const displayRef = ticket.referenceCode ?? ticket.id;
    const submissionTpl = await emailTemplates.ticketSubmissionConfirmation(
      user.name,
      sanitizedSubject,
      displayRef,
      ticket.id
    );
    sendEmail({
      to: user.email,
      subject: submissionTpl.subject,
      html: submissionTpl.html,
    })
      .then((success) => {
        if (!success) {
          console.error(`[Ticket Controller] Failed to send submission confirmation to submitter: ${user.email}`);
        }
      })
      .catch((err) => {
        console.error(`[Ticket Controller] Error sending submission confirmation:`, err);
      });

    // Send email asynchronously (non-blocking)
    if (assigned && reviewer) {
      const emailTemplate = await emailTemplates.newTicketAssigned(
        reviewer.userName,
        user.name,
        subject,
        displayRef
      );
      // Fire and forget - don't wait for email, but log errors
      sendEmail({
        to: reviewer.userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      }).then(success => {
        if (!success) {
          console.error(`[Ticket Controller] Failed to send email to reviewer: ${reviewer.userEmail}`);
        }
      }).catch(err => {
        console.error(`[Ticket Controller] Error sending email to reviewer:`, err);
      });
    }

    // Fetch the complete ticket with assigned user
    const completeTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Fire webhook asynchronously
    dispatchWebhookEvent("ticket.created", completeTicket);

    res.status(201).json(completeTicket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Get all tickets - optimized with select instead of include, with pagination
export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const total = await prisma.ticket.count();

    const tickets = await prisma.ticket.findMany({
      select: {
        id: true,
        referenceCode: true,
        submitterId: true,
        submitterName: true,
        submitterEmail: true,
        group: true,
        year: true,
        type: true,
        priority: true,
        subject: true,
        description: true,
        status: true,
        escalationLevel: true,
        submittedAt: true,
        updatedAt: true,
        firstResponseAt: true,
        resolvedAt: true,
        lastStatusChangedAt: true,
        assignedTo: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        submittedAt: "desc"
      },
      skip,
      take: limit,
    });

    res.json({
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Get a single ticket by ID
export const getTicketById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        submitter: {
          select: {
            id: true,
            submitterId: true,
            name: true,
            email: true,
            role: true,
            group: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        },
        attachments: true,
        statusHistory: {
          include: {
            changedUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: {
            changedAt: "asc"
          }
        }
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Update ticket status
export const updateTicketStatus = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, comment } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Validate status transition
    const validTransition = await isValidStatusTransition(ticket.status, status);
    if (!validTransition) {
      return res.status(400).json({
        error: "Invalid status transition",
        message: `Cannot transition from ${ticket.status} to ${status}`,
      });
    }

    const newStatus = status as string;
    const terminal = ["resolved", "rejected"];
    if (terminal.includes(newStatus) && user.role !== "registrar") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only the Registrar can resolve or reject petitions.",
      });
    }
    if (newStatus === "rejected" && !(typeof comment === "string" && comment.trim())) {
      return res.status(400).json({
        error: "Rejection reason required",
        message: "Provide a reason for rejection in the comment field.",
      });
    }
    let nextEscalationLevel = ticket.escalationLevel;
    let assignedTo = ticket.assignedTo;

    // Handle escalation if needed
    if (requiresEscalation(newStatus)) {
      nextEscalationLevel = getNextEscalationLevel(newStatus);
      const assigned = await autoAssignTicket(id, nextEscalationLevel, ticket.group);
      if (assigned) {
        const reviewer = await getNextReviewer(nextEscalationLevel, ticket.group);
        if (reviewer) {
          assignedTo = reviewer.userId;
        }
      }
    }

    // Update ticket and create status history entry
    const now = new Date();

    // Compute lifecycle fields
    const lifecycleUpdates: any = {
      lastStatusChangedAt: now,
      updatedAt: now,
    };

    // First response time: first transition away from "submitted"
    if (!ticket.firstResponseAt && ticket.status === "submitted" && newStatus !== "submitted") {
      lifecycleUpdates.firstResponseAt = now;
    }

    // Resolution time: when moving into a terminal/finished state
    const normalizedNewStatus = newStatus.toLowerCase();
    const isResolvedLike =
      normalizedNewStatus.includes("resolved") ||
      normalizedNewStatus.includes("closed") ||
      normalizedNewStatus.includes("rejected");
    if (isResolvedLike) {
      lifecycleUpdates.resolvedAt = now;
    }

    const sanitizedComment =
      typeof comment === "string" && comment.trim() ? sanitizeText(comment.trim()) : null;

    await prisma.$transaction([
      prisma.ticket.update({
        where: { id },
        data: {
          status: newStatus,
          escalationLevel: nextEscalationLevel,
          assignedTo,
          ...lifecycleUpdates,
        },
      }),
      prisma.ticketStatusHistory.create({
        data: {
          ticketId: id,
          previousStatus: ticket.status,
          newStatus,
          changedBy: req.user.id,
          changedByName: user.name,
          changedByRole: user.role,
          comment: sanitizedComment,
        },
      }),
      ...(sanitizedComment
        ? [
            prisma.ticketComment.create({
              data: {
                ticketId: id,
                authorId: req.user.id,
                authorName: user.name,
                authorRole: user.role,
                content: sanitizedComment,
                isInternal: false,
              },
            }),
          ]
        : []),
    ]);

    let assigneeName: string | null = null;
    if (assignedTo) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedTo },
        select: { name: true, role: true },
      });
      assigneeName = assignee?.name ?? null;
    }

    await recordAuditLog({
      userId: req.user.id,
      userName: user.name,
      userRole: user.role,
      action: "ticket.status_changed",
      resourceType: "ticket",
      resourceId: id,
      details: {
        summary: describeStatusChange(ticket.status, newStatus),
        previousStatus: ticket.status,
        newStatus,
        comment: sanitizedComment,
        escalationLevel: nextEscalationLevel,
        assignedTo,
        assignedToName: assigneeName,
      },
      req,
    });

    if (requiresEscalation(newStatus) && assignedTo && assigneeName) {
      await recordAuditLog({
        userId: req.user.id,
        userName: user.name,
        userRole: user.role,
        action: "ticket.assigned",
        resourceType: "ticket",
        resourceId: id,
        details: {
          assignedTo,
          assignedToName: assigneeName,
          escalationLevel: nextEscalationLevel,
          reason: describeStatusChange(ticket.status, newStatus),
        },
        req,
      });
    }

    // Batch create notifications and send emails asynchronously (non-blocking)
    const notifications = [
      {
        userId: ticket.submitterId,
        ticketId: id,
        title: "Grievance Status Updated",
        message: `Your grievance "${ticket.subject}" status has been updated to ${newStatus.replace(/_/g, " ")}.`,
        type: "info" as const,
      },
    ];

    // If escalated, get next reviewer info and prepare notification
    let nextReviewer: { id: string; email: string; name: string } | null = null;
    if (requiresEscalation(newStatus) && assignedTo) {
      nextReviewer = await prisma.user.findUnique({
        where: { id: assignedTo },
        select: { id: true, email: true, name: true },
      });

      if (nextReviewer) {
        notifications.push({
          userId: nextReviewer.id,
          ticketId: id,
          title: "Grievance Forwarded for Review",
          message: `A grievance "${ticket.subject}" has been forwarded to you for review.`,
          type: "info" as const,
        });
      }
    }

    // Create notifications in parallel (non-blocking)
    prisma.notification.createMany({
      data: notifications,
    }).catch(err => console.error("Error creating notifications:", err));

    // Send emails asynchronously (fire and forget)
    const submitterEmailTemplate = await emailTemplates.petitionStudentUpdate({
      submitterName: ticket.submitterName,
      ticketSubject: ticket.subject,
      referenceCode: ticket.referenceCode ?? id,
      ticketUuid: id,
      newStatus,
      actorName: user.name,
      actorRole: user.role,
      comment: sanitizedComment,
    });
    sendEmail({
      to: ticket.submitterEmail,
      subject: submitterEmailTemplate.subject,
      html: submitterEmailTemplate.html,
    }).then(success => {
      if (!success) {
        console.error(`[Ticket Controller] Failed to send status update email to submitter: ${ticket.submitterEmail}`);
      }
    }).catch(err => {
      console.error(`[Ticket Controller] Error sending email to submitter:`, err);
    });

    if (nextReviewer) {
      const displayRef = ticket.referenceCode ?? id;
      const reviewerEmailTemplate = await emailTemplates.nextReviewerAlert(
        nextReviewer.name,
        ticket.submitterName,
        ticket.subject,
        displayRef,
        nextEscalationLevel.toString()
      );
      sendEmail({
        to: nextReviewer.email,
        subject: reviewerEmailTemplate.subject,
        html: reviewerEmailTemplate.html,
      }).then(success => {
        if (!success) {
          console.error(`[Ticket Controller] Failed to send escalation email to reviewer: ${nextReviewer.email}`);
        }
      }).catch(err => {
        console.error(`[Ticket Controller] Error sending email to reviewer:`, err);
      });
    }

    // Fetch complete ticket with relations
    const completeTicket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        statusHistory: { orderBy: { changedAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
      },
    });

    // Fire webhook asynchronously
    dispatchWebhookEvent("ticket.status_changed", completeTicket);

    res.json(completeTicket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Add comment to ticket
export const addComment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content, isInternal } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Sanitize comment content
    const sanitizedContent = sanitizeText(content);

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        authorId: req.user.id,
        authorName: user.name,
        authorRole: user.role,
        content: sanitizedContent,
        isInternal: isInternal || false,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    await recordAuditLog({
      userId: req.user.id,
      userName: user.name,
      userRole: user.role,
      action: "ticket.comment_added",
      resourceType: "ticket",
      resourceId: id,
      details: {
        commentId: comment.id,
        isInternal: isInternal || false,
        preview: sanitizedContent.slice(0, 200),
      },
      req,
    });

    const isStaffComment =
      req.user.id !== ticket.submitterId &&
      user.role !== "student" &&
      !isInternal;
    if (isStaffComment && sanitizedContent.trim()) {
      const ref = ticket.referenceCode ?? id;
      const tpl = await emailTemplates.petitionStudentComment({
        submitterName: ticket.submitterName,
        ticketSubject: ticket.subject,
        referenceCode: ref,
        ticketUuid: id,
        actorName: user.name,
        actorRole: user.role,
        comment: sanitizedContent,
      });
      sendEmail({
        to: ticket.submitterEmail,
        subject: tpl.subject,
        html: tpl.html,
      }).catch((err) => console.error("[Ticket Controller] Comment notify email:", err));
    }

    res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Get user's tickets with pagination
export const getUserTickets = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const total = await prisma.ticket.count({
      where: { submitterId: req.user.id },
    });

    const tickets = await prisma.ticket.findMany({
      where: { submitterId: req.user.id },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        submittedAt: "desc"
      },
      skip,
      take: limit,
    });

    res.json({
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Update ticket details (only for submitters, only if status is "submitted")
export const updateTicket = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { subject, description, type, priority, year, group } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Only the owner (submitter) can edit, and only if status is "submitted"
    if (ticket.submitterId !== req.user.id) {
      return res.status(403).json({ error: "You can only edit your own tickets" });
    }

    if (ticket.status !== "submitted") {
      return res.status(400).json({
        error: "Cannot edit ticket",
        message: "You can only edit tickets that are still in 'submitted' status"
      });
    }

    // Sanitize inputs
    const sanitizedSubject = subject ? sanitizeInput(subject) : ticket.subject;
    const sanitizedDescription = description ? sanitizeText(description) : ticket.description;
    const sanitizedYear = year ? sanitizeInput(year) : ticket.year;

    let sanitizedGroup = ticket.group;
    if (group !== undefined && group !== null && String(group).trim() !== "") {
      const g = sanitizeInput(String(group));
      const tenant = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
      const allowed = Object.keys(effectiveGroupPrefixes(tenant?.groupPrefixes));
      if (!allowed.includes(g)) {
        return res.status(400).json({
          error: "Invalid department",
          message: "Choose a department from the configured list.",
        });
      }
      sanitizedGroup = g;
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        subject: sanitizedSubject,
        description: sanitizedDescription,
        type: type || ticket.type,
        priority: priority || ticket.priority,
        year: sanitizedYear,
        group: sanitizedGroup,
        updatedAt: new Date(),
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    await recordAuditLog({
      userId: req.user.id,
      userName: user?.name,
      userRole: user?.role,
      action: "ticket.updated",
      resourceType: "ticket",
      resourceId: id,
      details: {
        subject: sanitizedSubject,
        type: type || ticket.type,
        year: sanitizedYear,
        group: sanitizedGroup,
      },
      req,
    });

    res.json(updatedTicket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Delete ticket (only for submitters, only if status is "submitted")
export const deleteTicket = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Only the owner (submitter) can delete, and only if status is "submitted"
    if (ticket.submitterId !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own tickets" });
    }

    if (ticket.status !== "submitted") {
      return res.status(400).json({
        error: "Cannot delete ticket",
        message: "You can only delete tickets that are still in 'submitted' status"
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    await recordAuditLog({
      userId: req.user.id,
      userName: user?.name,
      userRole: user?.role,
      action: "ticket.deleted",
      resourceType: "ticket",
      resourceId: id,
      details: {
        subject: ticket.subject,
        status: ticket.status,
      },
      req,
    });

    // Delete related data first (cascade delete should handle this, but being explicit)
    await prisma.$transaction([
      prisma.ticketComment.deleteMany({ where: { ticketId: id } }),
      prisma.ticketAttachment.deleteMany({ where: { ticketId: id } }),
      prisma.ticketStatusHistory.deleteMany({ where: { ticketId: id } }),
      prisma.notification.deleteMany({ where: { ticketId: id } }),
      prisma.ticket.delete({ where: { id } }),
    ]);

    // TODO: Delete files from Supabase Storage when ticket is deleted
    // This should be done before deleting the ticket record

    res.json({ message: "Ticket deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Upload file to storage and attach to ticket (server-side; uses service role)
export const uploadAttachmentFile = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { fileName, mimeType, data } = req.body as {
    fileName?: string;
    mimeType?: string;
    data?: string;
  };

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!fileName || !data) {
      return res.status(400).json({ error: "fileName and data (base64) are required" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.submitterId !== req.user.id) {
      return res.status(403).json({ error: "You can only add attachments to your own tickets" });
    }

    if (ticket.status !== "submitted") {
      return res.status(400).json({
        error: "Cannot add attachment",
        message: "You can only add attachments to tickets that are still in 'submitted' status",
      });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(data, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid file data encoding" });
    }

    const validationError = validateAttachmentMeta(fileName, mimeType, buffer.length);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const uploaded = await uploadFile(buffer, fileName, id, req.user.id, mimeType);
    if (!uploaded) {
      return res.status(500).json({
        error: "File upload failed",
        message:
          "Storage is unavailable. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set on the server and the petition-attachments Storage bucket exists.",
      });
    }

    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: id,
        fileName: sanitizeInput(fileName),
        fileUrl: uploaded.url,
        fileSize: buffer.length,
        mimeType: mimeType || null,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    await recordAuditLog({
      userId: req.user.id,
      userName: user?.name,
      userRole: user?.role,
      action: "ticket.attachment_added",
      resourceType: "ticket",
      resourceId: id,
      details: { fileName: attachment.fileName, attachmentId: attachment.id },
      req,
    });

    res.status(201).json(attachment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Add attachment to ticket (metadata only — file already hosted)
export const addAttachment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { fileName, fileUrl, fileSize, mimeType } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Only the owner (submitter) can add attachments, and only if status is "submitted"
    if (ticket.submitterId !== req.user.id) {
      return res.status(403).json({ error: "You can only add attachments to your own tickets" });
    }

    if (ticket.status !== "submitted") {
      return res.status(400).json({
        error: "Cannot add attachment",
        message: "You can only add attachments to tickets that are still in 'submitted' status"
      });
    }

    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: id,
        fileName: sanitizeInput(fileName),
        fileUrl, // URL is already validated from Supabase
        fileSize: fileSize || null,
        mimeType: mimeType || null,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    await recordAuditLog({
      userId: req.user.id,
      userName: user?.name,
      userRole: user?.role,
      action: "ticket.attachment_added",
      resourceType: "ticket",
      resourceId: id,
      details: { fileName: attachment.fileName, attachmentId: attachment.id },
      req,
    });

    res.status(201).json(attachment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Delete attachment from ticket
export const deleteAttachment = async (req: AuthRequest, res: Response) => {
  const { id, attachmentId } = req.params;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const attachment = await prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.ticketId !== id) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Only the owner (submitter) can delete attachments, and only if status is "submitted"
    if (ticket.submitterId !== req.user.id) {
      return res.status(403).json({ error: "You can only delete attachments from your own tickets" });
    }

    if (ticket.status !== "submitted") {
      return res.status(400).json({
        error: "Cannot delete attachment",
        message: "You can only delete attachments from tickets that are still in 'submitted' status"
      });
    }

    // TODO: Delete file from Supabase Storage
    // await deleteFile(attachment.fileUrl);

    await prisma.ticketAttachment.delete({
      where: { id: attachmentId },
    });

    res.json({ message: "Attachment deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};
