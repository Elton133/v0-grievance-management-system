import type { NextFunction, Request, Response } from "express";
import prisma from "../db";
import { runWithTenant } from "../utils/tenantContext";

export interface OrganizationContext {
  id: string;
  slug: string;
  name: string;
  status: string;
  subscriptionTier: string;
}

export interface OrganizationRequest extends Request {
  organization?: OrganizationContext;
}

const cache = new Map<string, { value: OrganizationContext; expiresAt: number }>();
const CACHE_MS = 60_000;

function requestedSlug(req: Request): string {
  const header = req.header("x-organization-slug")?.trim().toLowerCase();
  if (header) return header;
  const bodySlug = typeof req.body?.organizationSlug === "string" ? req.body.organizationSlug : "";
  if (bodySlug.trim()) return bodySlug.trim().toLowerCase();
  return process.env.DEFAULT_ORGANIZATION_SLUG?.trim().toLowerCase() || "default";
}

export async function organizationMiddleware(req: OrganizationRequest, res: Response, next: NextFunction) {
  try {
    const slug = requestedSlug(req);
    const cached = cache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      req.organization = cached.value;
      return runWithTenant({ organizationId: cached.value.id, organizationSlug: cached.value.slug }, next);
    }

    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, status: true, subscriptionTier: true },
    });
    if (!organization) return res.status(404).json({ error: "Workspace not found" });
    if (organization.status !== "active") {
      return res.status(403).json({ error: "This workspace is not active" });
    }

    cache.set(slug, { value: organization, expiresAt: Date.now() + CACHE_MS });
    req.organization = organization;
    return runWithTenant({ organizationId: organization.id, organizationSlug: organization.slug }, next);
  } catch (error) {
    console.error("[Organization] Resolution failed:", error);
    return res.status(503).json({ error: "Workspace could not be resolved" });
  }
}
