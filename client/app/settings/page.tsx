"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { settingsApi } from "@/lib/api"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Shield, Save, RefreshCw, Palette, Users, Settings2, GitMerge } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import type { TenantSettings, RoleConfig, StatusConfig, PetitionTypeConfig, EscalationConfig } from "@/lib/settings-context"

export default function SettingsPage() {
  const { user } = useAuth()
  const { settings, refreshSettings, isLoading: settingsLoading } = useSettings()

  const [formData, setFormData] = useState<TenantSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Initialize form with backend settings
  useEffect(() => {
    if (settings && !settingsLoading) {
      setFormData(JSON.parse(JSON.stringify(settings))) // Deep clone
    }
  }, [settings, settingsLoading])

  // Only the highest level roles should access this page (level 3/registrar in default RMU setup)
  // Check if they are part of the higher-tier reviewers
  const isSuperAdmin = user && settings?.rolesConfig?.some(r => r.key === user.role && r.level >= 2)

  if (!user || settingsLoading || !formData) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You need super admin privileges to access organization settings.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // API expects a partial object, we just send all formData keys
      await settingsApi.update({
        organizationName: formData.organizationName,
        logoUrl: formData.logoUrl,
        primaryColor: formData.primaryColor,
        accentColor: formData.accentColor,
        rolesConfig: formData.rolesConfig,
        ticketTypesConfig: formData.ticketTypesConfig,
        statusLabelsConfig: formData.statusLabelsConfig,
        escalationConfig: formData.escalationConfig
      })
      toast.success("Settings saved successfully")
      await refreshSettings()
    } catch (error) {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all settings to their RMU defaults? This organization will lose all custom configurations.")) return
    
    setIsResetting(true)
    try {
      await settingsApi.reset()
      toast.success("Settings reset to defaults")
      await refreshSettings()
    } catch (error) {
      toast.error("Failed to reset settings")
    } finally {
      setIsResetting(false)
    }
  }

  const BrandingTab = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Organization Name</Label>
          <Input 
            value={formData.organizationName} 
            onChange={e => setFormData({ ...formData, organizationName: e.target.value })} 
            placeholder="e.g. Regional Maritime University"
          />
        </div>
        <div className="space-y-2">
          <Label>Logo URL (Optional)</Label>
          <Input 
            value={formData.logoUrl || ""} 
            onChange={e => setFormData({ ...formData, logoUrl: e.target.value })} 
            placeholder="https://example.com/logo.png"
          />
        </div>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 flex flex-col">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-3 mt-1">
            <input 
              type="color" 
              value={formData.primaryColor} 
              onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
              className="h-10 w-20 cursor-pointer rounded border p-1"
            />
            <Input 
              value={formData.primaryColor} 
              onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} 
              className="font-mono text-sm max-w-[120px]"
            />
          </div>
        </div>
        <div className="space-y-2 flex flex-col">
          <Label>Accent Color</Label>
          <div className="flex items-center gap-3 mt-1">
            <input 
              type="color" 
              value={formData.accentColor} 
              onChange={e => setFormData({ ...formData, accentColor: e.target.value })}
              className="h-10 w-20 cursor-pointer rounded border p-1"
            />
            <Input 
              value={formData.accentColor} 
              onChange={e => setFormData({ ...formData, accentColor: e.target.value })} 
              className="font-mono text-sm max-w-[120px]"
            />
          </div>
        </div>
      </div>
    </div>
  )

  const RolesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define the actors (roles) in your system. Level 0 is typically the submitter. Higher levels indicate higher escalation authority. There must always be at least one role with isSubmitter=true.
        </p>
      </div>

      <div className="rounded-md border">
        <div className="grid grid-cols-12 gap-4 border-b bg-muted/50 p-3 text-sm font-medium">
          <div className="col-span-3">Role Key</div>
          <div className="col-span-4">Display Label</div>
          <div className="col-span-2 text-center">Level</div>
          <div className="col-span-3 text-center">Settings</div>
        </div>
        
        {formData.rolesConfig.map((role, idx) => (
          <div key={idx} className="grid grid-cols-12 items-center gap-4 p-3 border-b last:border-0">
            <div className="col-span-3">
              <Input 
                value={role.key} 
                onChange={e => {
                  const newRoles = [...formData.rolesConfig]
                  newRoles[idx].key = e.target.value
                  setFormData({ ...formData, rolesConfig: newRoles })
                }}
                disabled={role.key === "student" || role.key === "submitter"} // lock base ones for safety in UI demo
                className="font-mono text-xs"
              />
            </div>
            <div className="col-span-4">
              <Input 
                value={role.label} 
                onChange={e => {
                  const newRoles = [...formData.rolesConfig]
                  newRoles[idx].label = e.target.value
                  setFormData({ ...formData, rolesConfig: newRoles })
                }}
              />
            </div>
            <div className="col-span-2 text-center">
              <Input 
                type="number"
                min="0"
                value={role.level} 
                onChange={e => {
                  const newRoles = [...formData.rolesConfig]
                  newRoles[idx].level = parseInt(e.target.value) || 0
                  setFormData({ ...formData, rolesConfig: newRoles })
                }}
              />
            </div>
            <div className="col-span-3 text-xs text-muted-foreground space-y-1">
              <div>{role.isSubmitter ? "✅ Submitter" : "❌ Reviewer"}</div>
              <div>{role.groupScoped ? "✅ Group-Scoped" : "❌ Global"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const TypesTab = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure the categories of tickets users can submit to your organization.</p>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formData.ticketTypesConfig.map((type, idx) => (
          <Card key={idx}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium">
                <Input 
                  value={type.label}
                  onChange={e => {
                    const newTypes = [...formData.ticketTypesConfig]
                    newTypes[idx].label = e.target.value
                    setFormData({ ...formData, ticketTypesConfig: newTypes })
                  }}
                  className="h-8"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs text-muted-foreground mb-1">Database Key:</p>
              <Input 
                value={type.key}
                disabled
                className="h-7 text-xs font-mono bg-muted"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Platform Customization</h2>
            <p className="text-muted-foreground">Manage tenant settings, branding, and workflows (CMS).</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleReset} disabled={isSaving || isResetting} className="flex-1 sm:flex-none">
              <RefreshCw className={`mr-2 h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
              Reset Defaults
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isResetting} className="flex-1 sm:flex-none">
              <Save className={`mr-2 h-4 w-4 ${isSaving ? "animate-pulse" : ""}`} />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="branding" className="w-full">
          <TabsList className="w-full sm:w-auto flex flex-wrap h-auto overflow-x-auto mb-6">
            <TabsTrigger value="branding" className="flex-1 sm:flex-none min-w-[120px] py-2.5">
              <Palette className="w-4 h-4 mr-2" /> Branding
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex-1 sm:flex-none min-w-[120px] py-2.5">
              <Users className="w-4 h-4 mr-2" /> Actors
            </TabsTrigger>
            <TabsTrigger value="types" className="flex-1 sm:flex-none min-w-[120px] py-2.5">
              <Settings2 className="w-4 h-4 mr-2" /> Ticket Types
            </TabsTrigger>
          </TabsList>

          <Card>
            <CardHeader>
              <CardTitle>Configuration Editor</CardTitle>
              <CardDescription>
                Changes made here will instantly affect the platform for all users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TabsContent value="branding" className="m-0 mt-4">
                <BrandingTab />
              </TabsContent>
              <TabsContent value="roles" className="m-0 mt-4">
                <RolesTab />
              </TabsContent>
              <TabsContent value="types" className="m-0 mt-4">
                <TypesTab />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
