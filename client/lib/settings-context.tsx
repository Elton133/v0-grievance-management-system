"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { converter, formatCss } from "culori"
import { normalizeAllowedEmailDomains } from "./allowed-email-domains"
import { DEFAULT_RMU_GROUP_PREFIXES } from "./rmu-departments"

// Types for tenant settings
export interface RoleConfig {
  key: string
  label: string
  level: number
  isSubmitter?: boolean
  groupScoped?: boolean
}

export interface StatusConfig {
  key: string
  label: string
  color: string
}

export interface TicketTypeConfig {
  key: string
  label: string
}

export interface EscalationConfig {
  fromStatus: string
  toStatuses: string[]
}

export interface TenantSettings {
  id: string
  organizationName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  supportEmail: string | null
  rolesConfig: RoleConfig[]
  escalationConfig: EscalationConfig[]
  ticketTypesConfig: TicketTypeConfig[]
  statusLabelsConfig: StatusConfig[]
  allowedEmailDomains: string[]
  groupPrefixes: Record<string, string[]>
}

// Defaults (used before settings are fetched)
const DEFAULT_SETTINGS: TenantSettings = {
  id: "default",
  organizationName: "Grievance Management System",
  logoUrl: null,
  primaryColor: "#2563eb",
  accentColor: "#1e40af",
  supportEmail: null,
  rolesConfig: [
    { key: "student", label: "Student", level: 0, isSubmitter: true, groupScoped: true },
    { key: "advisor", label: "Advisor", level: 1, isSubmitter: false, groupScoped: true },
    { key: "registrar", label: "Registrar", level: 2, isSubmitter: false, groupScoped: false },
  ],
  escalationConfig: [],
  ticketTypesConfig: [
    { key: "fee_issues", label: "Fee issues" },
    { key: "results_issues", label: "Results issues" },
  ],
  statusLabelsConfig: [
    { key: "submitted", label: "Submitted", color: "#f59e0b" },
    { key: "under_review", label: "Under Review", color: "#3b82f6" },
    { key: "forwarded_to_hod", label: "Forwarded to Registrar", color: "#8b5cf6" },
    { key: "forwarded_to_registrar", label: "Forwarded to Registrar", color: "#6366f1" },
    { key: "resolved", label: "Resolved", color: "#22c55e" },
    { key: "rejected", label: "Rejected", color: "#ef4444" },
  ],
  allowedEmailDomains: ["st.rmu.edu.gh", "rmu.edu.gh"],
  groupPrefixes: DEFAULT_RMU_GROUP_PREFIXES,
}

interface SettingsContextType {
  settings: TenantSettings
  isLoading: boolean
  refreshSettings: () => Promise<void>
  // Helpers
  getRoleLabel: (roleKey: string) => string
  getStatusLabel: (statusKey: string) => string
  getStatusColor: (statusKey: string) => string
  getTicketTypeLabel: (typeKey: string) => string
  getSubmitterRole: () => RoleConfig | undefined
  getReviewerRoles: () => RoleConfig[]
  isSubmitterRole: (roleKey: string) => boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`)
      if (response.ok) {
        const data = await response.json()
        setSettings({
          ...data,
          allowedEmailDomains: normalizeAllowedEmailDomains(data.allowedEmailDomains),
        })

        // Apply CSS custom properties for dynamic theming (Tailwind v4 theme overrides)
        if (typeof document !== "undefined") {
          try {
            // Update core semantic colors; Tailwind theme variables derive from these
            document.documentElement.style.setProperty("--primary", data.primaryColor)
            document.documentElement.style.setProperty("--accent", data.accentColor)
            document.documentElement.style.setProperty("--ring", data.primaryColor)
            document.documentElement.style.setProperty("--sidebar-primary", data.primaryColor)

            // Also update direct Tailwind color tokens for any components that reference them directly
            document.documentElement.style.setProperty("--color-primary", data.primaryColor)
            document.documentElement.style.setProperty("--color-accent", data.accentColor)
            document.documentElement.style.setProperty("--color-ring", data.primaryColor)
            document.documentElement.style.setProperty("--color-sidebar-primary", data.primaryColor)
          } catch (e) {
            console.error("Failed to set theme colors", e)
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
      // Keep defaults
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  // Helper functions
  const getRoleLabel = (roleKey: string): string => {
    const role = settings.rolesConfig.find(r => r.key === roleKey)
    return role?.label || roleKey.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
  }

  const getStatusLabel = (statusKey: string): string => {
    const status = settings.statusLabelsConfig.find(s => s.key === statusKey)
    return status?.label || statusKey.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
  }

  const getStatusColor = (statusKey: string): string => {
    const status = settings.statusLabelsConfig.find(s => s.key === statusKey)
    return status?.color || "#6b7280"
  }

  const getTicketTypeLabel = (typeKey: string): string => {
    const type = settings.ticketTypesConfig.find(t => t.key === typeKey)
    return type?.label || typeKey.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
  }

  const getSubmitterRole = (): RoleConfig | undefined => {
    return (settings.rolesConfig ?? []).find((r) => r.isSubmitter)
  }

  const getReviewerRoles = (): RoleConfig[] => {
    return settings.rolesConfig.filter(r => !r.isSubmitter).sort((a, b) => a.level - b.level)
  }

  const isSubmitterRole = useCallback((roleKey: string): boolean => {
    const submitter = (settings.rolesConfig ?? []).find((r) => r.isSubmitter)
    if (submitter?.key === roleKey) return true
    if (submitter?.key === "student" && roleKey === "submitter") return true
    if (submitter?.key === "submitter" && roleKey === "student") return true
    return false
  }, [settings.rolesConfig])

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        refreshSettings: fetchSettings,
        getRoleLabel,
        getStatusLabel,
        getStatusColor,
        getTicketTypeLabel,
        getSubmitterRole,
        getReviewerRoles,
        isSubmitterRole,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
