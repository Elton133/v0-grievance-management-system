import { Response } from "express";
import prisma from "../db";
import { AuthRequest } from "../middleware/auth";

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

    const petition = await prisma.petition.create({
      data: {
        studentId: req.user.id,
        studentName: user.name,
        studentEmail: user.email,
        department: department || user.department || "Unknown",
        year: year || "Unknown",
        type,
        subject,
        description,
        priority: priority || "medium",
        status: "submitted"
      },
    });

    res.status(201).json(petition);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err });
  }
};

// Get all petitions
export const getPetitions = async (req: AuthRequest, res: Response) => {
  try {
    const petitions = await prisma.petition.findMany({
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

    // Update petition and create status history entry
    const [updatedPetition] = await prisma.$transaction([
      prisma.petition.update({
        where: { id },
        data: { status, updatedAt: new Date() },
      }),
      prisma.petitionStatusHistory.create({
        data: {
          petitionId: id,
          previousStatus: petition.status,
          newStatus: status,
          changedBy: req.user.id,
          changedByName: user.name,
          changedByRole: user.role,
          comment: comment || null,
        },
      }),
    ]);

    res.json(updatedPetition);
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
