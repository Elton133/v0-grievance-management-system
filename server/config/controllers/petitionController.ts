import { Response } from "express";
import prisma from "../db";
import { AuthRequest } from "../middleware/auth";
import { PetitionStatus } from "@prisma/client";
import {
  autoAssignPetition,
  isValidStatusTransition,
  getNextEscalationLevel,
  requiresEscalation,
  getNextReviewer,
} from "../utils/workflowService";
import { sendEmail, emailTemplates } from "../utils/emailService";

// Create a new petition
export const createPetition = async (req: AuthRequest, res: Response) => {
  const { subject, description, type, department, year, priority } = req.body;
  
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const petitionDepartment = department || user.department || "Unknown";
    const petitionYear = year || "Unknown";

    // Create petition
    const petition = await prisma.petition.create({
      data: {
        studentId: req.user.id,
        studentName: user.name,
        studentEmail: user.email,
        department: petitionDepartment,
        year: petitionYear,
        type,
        subject,
        description,
        priority: priority || "medium",
        status: "submitted",
        escalationLevel: 1, // Start at level 1 (Class Advisor)
      },
    });

    // Auto-assign to first reviewer (Class Advisor) - optimized to get reviewer in one query
    const reviewer = await getNextReviewer(1, petitionDepartment);
    const assigned = reviewer ? await autoAssignPetition(petition.id, 1, petitionDepartment) : false;
    
    // Batch create notifications (non-blocking)
    const notifications = [
      {
        userId: req.user.id,
        petitionId: petition.id,
        title: "Grievance Submitted",
        message: `Your grievance "${subject}" has been submitted and is awaiting review.`,
        type: "info" as const,
      },
    ];

    if (assigned && reviewer) {
      notifications.push({
        userId: reviewer.userId,
        petitionId: petition.id,
        title: "New Grievance Assigned",
        message: `A new grievance "${subject}" has been assigned to you for review.`,
        type: "info" as const,
      });
    }

    // Create notifications in parallel (non-blocking for response)
    prisma.notification.createMany({
      data: notifications,
    }).catch(err => console.error("Error creating notifications:", err));

    // Send email asynchronously (non-blocking)
    if (assigned && reviewer) {
      const emailTemplate = emailTemplates.newPetitionAssigned(
        reviewer.userName,
        user.name,
        subject,
        petition.id
      );
      // Fire and forget - don't wait for email, but log errors
      sendEmail({
        to: reviewer.userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      }).then(success => {
        if (!success) {
          console.error(`[Petition Controller] Failed to send email to reviewer: ${reviewer.userEmail}`);
        }
      }).catch(err => {
        console.error(`[Petition Controller] Error sending email to reviewer:`, err);
      });
    }

    // Fetch the complete petition with assigned user
    const completePetition = await prisma.petition.findUnique({
      where: { id: petition.id },
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

    res.status(201).json(completePetition);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Get all petitions - optimized with select instead of include
export const getPetitions = async (req: AuthRequest, res: Response) => {
  try {
    const petitions = await prisma.petition.findMany({
      select: {
        id: true,
        studentId: true,
        studentName: true,
        studentEmail: true,
        department: true,
        year: true,
        type: true,
        priority: true,
        subject: true,
        description: true,
        status: true,
        escalationLevel: true,
        submittedAt: true,
        updatedAt: true,
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
      take: 1000, // Limit results to prevent large queries
    });

    res.json(petitions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Get a single petition by ID
export const getPetitionById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const petition = await prisma.petition.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true
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

    if (!petition) {
      return res.status(404).json({ error: "Petition not found" });
    }

    res.json(petition);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Update petition status
export const updatePetitionStatus = async (req: AuthRequest, res: Response) => {
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

    const petition = await prisma.petition.findUnique({ where: { id } });
    if (!petition) {
      return res.status(404).json({ error: "Petition not found" });
    }

    // Validate status transition
    if (!isValidStatusTransition(petition.status, status as PetitionStatus)) {
      return res.status(400).json({
        error: "Invalid status transition",
        message: `Cannot transition from ${petition.status} to ${status}`,
      });
    }

    const newStatus = status as PetitionStatus;
    let nextEscalationLevel = petition.escalationLevel;
    let assignedTo = petition.assignedTo;

    // Handle escalation if needed
    if (requiresEscalation(newStatus)) {
      nextEscalationLevel = getNextEscalationLevel(newStatus);
      const assigned = await autoAssignPetition(id, nextEscalationLevel, petition.department);
      if (assigned) {
        const reviewer = await getNextReviewer(nextEscalationLevel, petition.department);
        if (reviewer) {
          assignedTo = reviewer.userId;
        }
      }
    }

    // Update petition and create status history entry
    const [updatedPetition] = await prisma.$transaction([
      prisma.petition.update({
        where: { id },
        data: {
          status: newStatus,
          escalationLevel: nextEscalationLevel,
          assignedTo,
          updatedAt: new Date(),
        },
      }),
      prisma.petitionStatusHistory.create({
        data: {
          petitionId: id,
          previousStatus: petition.status,
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
        userId: petition.studentId,
        petitionId: id,
        title: "Grievance Status Updated",
        message: `Your grievance "${petition.subject}" status has been updated to ${newStatus.replace(/_/g, " ")}.`,
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
          petitionId: id,
          title: "Grievance Forwarded for Review",
          message: `A grievance "${petition.subject}" has been forwarded to you for review.`,
          type: "info" as const,
        });
      }
    }

    // Create notifications in parallel (non-blocking)
    prisma.notification.createMany({
      data: notifications,
    }).catch(err => console.error("Error creating notifications:", err));

    // Send emails asynchronously (fire and forget)
    const studentEmailTemplate = emailTemplates.petitionStatusUpdate(
      petition.studentName,
      petition.subject,
      newStatus,
      comment
    );
    sendEmail({
      to: petition.studentEmail,
      subject: studentEmailTemplate.subject,
      html: studentEmailTemplate.html,
    }).then(success => {
      if (!success) {
        console.error(`[Petition Controller] Failed to send status update email to student: ${petition.studentEmail}`);
      }
    }).catch(err => {
      console.error(`[Petition Controller] Error sending email to student:`, err);
    });

    if (nextReviewer) {
      const reviewerEmailTemplate = emailTemplates.nextReviewerAlert(
        nextReviewer.name,
        petition.studentName,
        petition.subject,
        id,
        nextEscalationLevel.toString()
      );
      sendEmail({
        to: nextReviewer.email,
        subject: reviewerEmailTemplate.subject,
        html: reviewerEmailTemplate.html,
      }).then(success => {
        if (!success) {
          console.error(`[Petition Controller] Failed to send escalation email to reviewer: ${nextReviewer.email}`);
        }
      }).catch(err => {
        console.error(`[Petition Controller] Error sending email to reviewer:`, err);
      });
    }

    // Fetch complete petition with relations
    const completePetition = await prisma.petition.findUnique({
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

    res.json(completePetition);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Add comment to petition
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

    const petition = await prisma.petition.findUnique({ where: { id } });
    if (!petition) {
      return res.status(404).json({ error: "Petition not found" });
    }

    const comment = await prisma.petitionComment.create({
      data: {
        petitionId: id,
        authorId: req.user.id,
        authorName: user.name,
        authorRole: user.role,
        content,
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

// Get user's petitions
export const getUserPetitions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const petitions = await prisma.petition.findMany({
      where: { studentId: req.user.id },
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
      }
    });

    res.json(petitions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Update petition details (only for students, only if status is "submitted")
export const updatePetition = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { subject, description, type, priority, year, department } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const petition = await prisma.petition.findUnique({ where: { id } });
    if (!petition) {
      return res.status(404).json({ error: "Petition not found" });
    }

    // Only the owner (student) can edit, and only if status is "submitted"
    if (petition.studentId !== req.user.id) {
      return res.status(403).json({ error: "You can only edit your own petitions" });
    }

    if (petition.status !== "submitted") {
      return res.status(400).json({ 
        error: "Cannot edit petition", 
        message: "You can only edit petitions that are still in 'submitted' status" 
      });
    }

    const updatedPetition = await prisma.petition.update({
      where: { id },
      data: {
        subject: subject || petition.subject,
        description: description || petition.description,
        type: type || petition.type,
        priority: priority || petition.priority,
        year: year || petition.year,
        department: department || petition.department,
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

    res.json(updatedPetition);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Delete petition (only for students, only if status is "submitted")
export const deletePetition = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const petition = await prisma.petition.findUnique({ where: { id } });
    if (!petition) {
      return res.status(404).json({ error: "Petition not found" });
    }

    // Only the owner (student) can delete, and only if status is "submitted"
    if (petition.studentId !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own petitions" });
    }

    if (petition.status !== "submitted") {
      return res.status(400).json({ 
        error: "Cannot delete petition", 
        message: "You can only delete petitions that are still in 'submitted' status" 
      });
    }

    // Delete related data first (cascade delete should handle this, but being explicit)
    await prisma.$transaction([
      prisma.petitionComment.deleteMany({ where: { petitionId: id } }),
      prisma.petitionAttachment.deleteMany({ where: { petitionId: id } }),
      prisma.petitionStatusHistory.deleteMany({ where: { petitionId: id } }),
      prisma.notification.deleteMany({ where: { petitionId: id } }),
      prisma.petition.delete({ where: { id } }),
    ]);

    res.json({ message: "Petition deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};
