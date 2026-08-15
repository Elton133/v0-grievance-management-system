import { Request, Response } from "express";
import prisma from "../db";
import { AuthRequest } from "../middleware/auth";
import { normalizeAllowedEmailDomains } from "../utils/allowedEmailDomains";
import { schoolBuildBlocksRequest, schoolBuildSettingsForbidden } from "../utils/schoolBuild";
import {
  DEFAULT_RMU_GROUP_PREFIXES,
  effectiveGroupPrefixes,
} from "../utils/defaultGroupPrefixes";
import { isSystemAdminRole } from "../utils/roleUtils";
import type { OrganizationRequest } from "../middleware/organization";

// Default configuration values for a new tenant (RMU defaults)
export const DEFAULT_SETTINGS = {
  organizationName: "Resolve",
  primaryColor: "#2563eb",
  accentColor: "#0f172a",
  marketingContent: {
    heroBadge: "Built for institutions that listen",
    heroTitle: "Turn every concern into",
    heroHighlight: "meaningful action.",
    heroDescription: "Give students, staff and leadership one transparent system to raise issues, coordinate responses and build a more accountable institution.",
    primaryCta: "See the platform in action",
    demoTitle: "Make listening part of how your institution works.",
    demoDescription: "Tell us about your organization. We’ll show you how the platform can fit your teams and workflows.",
    footerTagline: "Clear concerns. Accountable teams. Better institutions.",
  },
  rolesConfig: [
    { key: "student", label: "Student", level: 0, isSubmitter: true, groupScoped: true },
    { key: "advisor", label: "Advisor", level: 1, isSubmitter: false, groupScoped: true },
    { key: "hod", label: "Head of Department", level: 2, isSubmitter: false, groupScoped: true },
    { key: "registrar", label: "Registrar", level: 3, isSubmitter: false, groupScoped: false },
    { key: "admin", label: "System Administrator", level: 4, isSubmitter: false, groupScoped: false },
  ],
  escalationConfig: [
    { fromStatus: "submitted", toStatuses: ["under_review", "forwarded_to_hod"] },
    { fromStatus: "under_review", toStatuses: ["forwarded_to_hod"] },
    { fromStatus: "forwarded_to_hod", toStatuses: ["forwarded_to_registrar"] },
    { fromStatus: "forwarded_to_registrar", toStatuses: ["resolved", "rejected"] },
    { fromStatus: "resolved", toStatuses: [] },
    { fromStatus: "rejected", toStatuses: [] },
  ],
  ticketTypesConfig: [
    { key: "fee_issues", label: "Fee issues" },
    { key: "results_issues", label: "Results issues" },
  ],
  statusLabelsConfig: [
    { key: "submitted", label: "Submitted", color: "#f59e0b" },
    { key: "under_review", label: "Under Review", color: "#3b82f6" },
    { key: "forwarded_to_hod", label: "Forwarded to HOD", color: "#8b5cf6" },
    { key: "forwarded_to_registrar", label: "Forwarded to Registrar", color: "#6366f1" },
    { key: "resolved", label: "Resolved", color: "#22c55e" },
    { key: "rejected", label: "Rejected", color: "#ef4444" },
  ],
  allowedEmailDomains: ["st.rmu.edu.gh", "rmu.edu.gh"],
  groupPrefixes: DEFAULT_RMU_GROUP_PREFIXES,
};

/**
 * GET /api/settings — Public endpoint
 * Returns tenant configuration for the frontend
 */
export const getSettings = async (req: OrganizationRequest, res: Response) => {
  try {
    const organizationId = req.organization?.id;
    if (!organizationId) return res.status(400).json({ error: "Workspace is required" });
    let settings = await prisma.tenantSettings.findUnique({
      where: { organizationId },
    });

    // Auto-create default settings if none exist
    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: {
          organizationId,
          ...DEFAULT_SETTINGS,
        },
      });
    }

    res.json({
      ...settings,
      allowedEmailDomains: normalizeAllowedEmailDomains(settings.allowedEmailDomains),
      groupPrefixes: effectiveGroupPrefixes(settings.groupPrefixes),
    });
  } catch (err) {
    console.error("[Settings] Error fetching settings:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
};

/**
 * PUT /api/settings — Admin-only endpoint
 * Updates tenant configuration
 */
export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res);
    }

    const user = await prisma.user.findFirst({ where: { id: req.user.id, organizationId: req.user.organizationId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!isSystemAdminRole(user.role)) {
      return res.status(403).json({ error: "Only system administrators can modify settings" });
    }

    const {
      organizationName,
      logoUrl,
      primaryColor,
      accentColor,
      supportEmail,
      marketingContent,
      rolesConfig,
      escalationConfig,
      ticketTypesConfig,
      statusLabelsConfig,
      allowedEmailDomains,
      groupPrefixes,
    } = req.body;

    // Build update data — only include fields that were provided
    const updateData: any = {};
    if (organizationName !== undefined) updateData.organizationName = organizationName;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
    if (accentColor !== undefined) updateData.accentColor = accentColor;
    if (supportEmail !== undefined) updateData.supportEmail = supportEmail;
    if (marketingContent !== undefined) updateData.marketingContent = marketingContent;
    if (rolesConfig !== undefined) updateData.rolesConfig = rolesConfig;
    if (escalationConfig !== undefined) updateData.escalationConfig = escalationConfig;
    if (ticketTypesConfig !== undefined) updateData.ticketTypesConfig = ticketTypesConfig;
    if (statusLabelsConfig !== undefined) updateData.statusLabelsConfig = statusLabelsConfig;
    if (allowedEmailDomains !== undefined) {
      updateData.allowedEmailDomains = normalizeAllowedEmailDomains(allowedEmailDomains);
    }
    if (groupPrefixes !== undefined) updateData.groupPrefixes = groupPrefixes;

    const settings = await prisma.tenantSettings.upsert({
      where: { organizationId: req.user.organizationId },
      update: updateData,
      create: {
        organizationId: req.user.organizationId,
        ...DEFAULT_SETTINGS,
        ...updateData,
      },
    });

    res.json({
      ...settings,
      allowedEmailDomains: normalizeAllowedEmailDomains(settings.allowedEmailDomains),
      groupPrefixes: effectiveGroupPrefixes(settings.groupPrefixes),
    });
  } catch (err) {
    console.error("[Settings] Error updating settings:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
};

/**
 * POST /api/settings/reset — Admin-only endpoint
 * Resets settings to defaults
 */
export const resetSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (await schoolBuildBlocksRequest(req, res)) {
      return schoolBuildSettingsForbidden(res);
    }

    const user = await prisma.user.findFirst({ where: { id: req.user.id, organizationId: req.user.organizationId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const settings = await prisma.tenantSettings.upsert({
      where: { organizationId: req.user.organizationId },
      update: DEFAULT_SETTINGS,
      create: {
        organizationId: req.user.organizationId,
        ...DEFAULT_SETTINGS,
      },
    });

    res.json({
      ...settings,
      allowedEmailDomains: normalizeAllowedEmailDomains(settings.allowedEmailDomains),
      groupPrefixes: effectiveGroupPrefixes(settings.groupPrefixes),
    });
  } catch (err) {
    console.error("[Settings] Error resetting settings:", err);
    res.status(500).json({ error: "Failed to reset settings" });
  }
};
