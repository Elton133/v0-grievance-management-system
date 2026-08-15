import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { OrganizationRequest } from "./organization";

export interface AuthRequest extends OrganizationRequest {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    organizationSlug: string;
    isPlatformOwner: boolean;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      organizationId?: string;
      organizationSlug?: string;
      isPlatformOwner?: boolean;
    };
    if (!decoded.organizationId || !decoded.organizationSlug) {
      return res.status(401).json({ error: "Session is missing workspace context. Please sign in again." });
    }
    if (req.organization && (
      decoded.organizationId !== req.organization.id ||
      decoded.organizationSlug !== req.organization.slug
    )) {
      return res.status(403).json({ error: "This session belongs to a different workspace." });
    }
    req.user = {
      id: decoded.id,
      email: decoded.email,
      organizationId: decoded.organizationId,
      organizationSlug: decoded.organizationSlug,
      isPlatformOwner: decoded.isPlatformOwner === true,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
