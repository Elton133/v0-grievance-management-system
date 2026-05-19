import { Request, Response } from "express";
import prisma from "../db";
import { AuthRequest } from "../middleware/auth";
import { normalizeAllowedEmailDomains } from "../utils/allowedEmailDomains";
import { isSchoolBuild, schoolBuildSettingsForbidden } from "../utils/schoolBuild";
import {
  DEFAULT_RMU_GROUP_PREFIXES,
  effectiveGroupPrefixes,
} from "../utils/defaultGroupPrefixes";

// Default configuration values for a new tenant (RMU defaults)
const DEFAULT_SETTINGS = {
  organizationName: "Grievance Management System",
  primaryColor: "#2563eb",
  accentColor: "#1e40af",
  rolesConfig: [
    { key: "student", label: "Student", level: 0, isSubmitter: true, groupScoped: true },
    { key: "advisor", label: "Advisor", level: 1, isSubmitter: false, groupScoped: true },
    { key: "hod", label: "Head of Department", level: 2, isSubmitter: false, groupScoped: true },
    { key: "registrar", label: "Registrar", level: 3, isSubmitter: false, groupScoped: false },
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
export const getSettings = async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.tenantSettings.findUnique({
      where: { id: "default" },
    });

    // Auto-create default settings if none exist
    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: {
          id: "default",
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
    if (isSchoolBuild()) {
      return schoolBuildSettingsForbidden(res);
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has admin privileges (highest role level)
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get current settings to check admin role
    const currentSettings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
    const roles = (currentSettings?.rolesConfig as Array<{ key: string; level: number }>) || DEFAULT_SETTINGS.rolesConfig;
    const userRoleConfig = roles.find(r => r.key === user.role);
    const maxLevel = Math.max(...roles.map(r => r.level));

    // Only highest-level role can edit settings (e.g., registrar)
    if (!userRoleConfig || userRoleConfig.level < maxLevel) {
      return res.status(403).json({ error: "Only the highest-level administrator can modify settings" });
    }

    const {
      organizationName,
      logoUrl,
      primaryColor,
      accentColor,
      supportEmail,
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
    if (rolesConfig !== undefined) updateData.rolesConfig = rolesConfig;
    if (escalationConfig !== undefined) updateData.escalationConfig = escalationConfig;
    if (ticketTypesConfig !== undefined) updateData.ticketTypesConfig = ticketTypesConfig;
    if (statusLabelsConfig !== undefined) updateData.statusLabelsConfig = statusLabelsConfig;
    if (allowedEmailDomains !== undefined) {
      updateData.allowedEmailDomains = normalizeAllowedEmailDomains(allowedEmailDomains);
    }
    if (groupPrefixes !== undefined) updateData.groupPrefixes = groupPrefixes;

    const settings = await prisma.tenantSettings.upsert({
      where: { id: "default" },
      update: updateData,
      create: {
        id: "default",
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
    if (isSchoolBuild()) {
      return schoolBuildSettingsForbidden(res);
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const settings = await prisma.tenantSettings.upsert({
      where: { id: "default" },
      update: DEFAULT_SETTINGS,
      create: {
        id: "default",
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
