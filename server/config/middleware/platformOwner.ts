import type { NextFunction, Response } from "express";
import type { AuthRequest } from "./auth";
import prisma from "../db";

export async function requirePlatformOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.isPlatformOwner) return res.status(403).json({ error: "Platform owner access required" });
  const owner = await prisma.user.findFirst({
    where: { id: req.user.id, organizationId: req.user.organizationId, isPlatformOwner: true },
    select: { id: true },
  });
  if (!owner) return res.status(403).json({ error: "Platform owner access required" });
  next();
}
