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

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
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

    // Auto-assign to first reviewer (Class Advisor) - optimized to get reviewer in one query
    const reviewer = await getNextReviewer(1, ticketGroup);
    const assigned = reviewer ? await autoAssignTicket(ticket.id, 1, ticketGroup) : false;

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
    const submissionTpl = await emailTemplates.ticketSubmissionConfirmation(
      user.name,
      sanitizedSubject,
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
        ticket.id
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
            changedAt: "desc"
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

    const [updatedTicket] = await prisma.$transaction([
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
          comment: comment || null,
        },
      }),
    ]);

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
    const submitterEmailTemplate = await emailTemplates.ticketStatusUpdate(
      ticket.submitterName,
      ticket.subject,
      newStatus,
      comment
    );
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
      const reviewerEmailTemplate = await emailTemplates.nextReviewerAlert(
        nextReviewer.name,
        ticket.submitterName,
        ticket.subject,
        id,
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
    const sanitizedGroup = group ? sanitizeInput(group) : ticket.group;

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

// Add attachment to ticket
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
