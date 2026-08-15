import type { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../db";
import { DEFAULT_SETTINGS } from "./settingsController";
import { runWithoutTenantScope } from "../utils/tenantContext";

const slugSchema = z.string().trim().toLowerCase().min(3).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const requestSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  preferredSlug: slugSchema,
  contactName: z.string().trim().min(2).max(100),
  contactEmail: z.string().trim().email().max(200),
  message: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(80).optional(),
});

const createSchema = z.object({
  requestId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  slug: slugSchema,
  adminName: z.string().trim().min(2).max(100),
  adminEmail: z.string().trim().email().max(200),
  adminPassword: z.string().min(12).max(128),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f172a"),
  logoUrl: z.string().url().nullable().optional(),
  allowedEmailDomains: z.array(z.string().trim().min(3).max(120)).default([]),
});

export async function requestWorkspace(req: Request, res: Response) {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid workspace request", details: parsed.error.flatten() });
  const row = await runWithoutTenantScope(() => prisma.workspaceRequest.create({ data: parsed.data }));
  return res.status(202).json({ id: row.id, status: row.status, message: "Workspace request received" });
}

export async function listOrganizations(_req: Request, res: Response) {
  const organizations = await runWithoutTenantScope(() => prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, tickets: true } } },
  }));
  return res.json({ data: organizations });
}

export async function listWorkspaceRequests(req: Request, res: Response) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const requests = await runWithoutTenantScope(() => prisma.workspaceRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  }));
  return res.json({ data: requests });
}

export async function listDemoRequests(req: Request, res: Response) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const requests = await runWithoutTenantScope(() => prisma.demoRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  }));
  return res.json({ data: requests });
}

export async function createOrganization(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid organization", details: parsed.error.flatten() });
  const input = parsed.data;
  const passwordHash = await bcrypt.hash(input.adminPassword, 12);

  try {
    const organization = await runWithoutTenantScope(() => prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: input.name, slug: input.slug, status: "active", subscriptionTier: "starter" },
      });
      await tx.tenantSettings.create({
        data: {
          organizationId: org.id,
          ...DEFAULT_SETTINGS,
          organizationName: input.name,
          primaryColor: input.primaryColor,
          accentColor: input.accentColor,
          logoUrl: input.logoUrl || null,
          allowedEmailDomains: input.allowedEmailDomains,
        },
      });
      await tx.user.create({
        data: {
          organizationId: org.id,
          name: input.adminName,
          email: input.adminEmail.toLowerCase(),
          passwordHash,
          role: "admin",
          emailVerified: true,
        },
      });
      if (input.requestId) {
        await tx.workspaceRequest.update({ where: { id: input.requestId }, data: { status: "approved" } });
      }
      return org;
    }));
    return res.status(201).json({ organization, workspaceUrl: `/?workspace=${organization.slug}` });
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ error: "That workspace slug is already in use" });
    console.error("[Platform] Organization creation failed:", error);
    return res.status(500).json({ error: "Could not create organization" });
  }
}

export async function updateOrganization(req: Request, res: Response) {
  const parsed = z.object({
    status: z.enum(["active", "suspended", "archived"]).optional(),
    subscriptionTier: z.enum(["starter", "professional", "enterprise"]).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid organization update" });
  const organization = await runWithoutTenantScope(() => prisma.organization.update({
    where: { id: req.params.id }, data: parsed.data,
  }));
  return res.json({ organization });
}
