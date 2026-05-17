"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { isSchoolBuild } from "@/lib/school-build"
import { settingsApi } from "@/lib/api"
import { Shield, Save, RefreshCw, Palette, Users, Settings2, GitMerge } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import Image from "next/image"
import type { TenantSettings, RoleConfig, StatusConfig, TicketTypeConfig, EscalationConfig } from "@/lib/settings-context"

/** Derive a readable internal key from a display name; ensures uniqueness among existing keys. */
function suggestUniqueRoleKey(existing: { key: string }[], baseLabel: string): string {
  const base =
    baseLabel
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "advisor"
  let key = base
  let n = 1
  while (existing.some((r) => r.key === key)) {
    key = `${base}_${n++}`
  }
  return key
}

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { settings, refreshSettings, isLoading: settingsLoading, isSubmitterRole } = useSettings()

  useEffect(() => {
    if (!isSchoolBuild() || !user) return
    router.replace(isSubmitterRole(user.role) ? "/dashboard" : "/admin")
  }, [user, router, isSubmitterRole])

  const [formData, setFormData] = useState<TenantSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Initialize form with backend settings
  useEffect(() => {
    if (settings && !settingsLoading) {
      setFormData(JSON.parse(JSON.stringify(settings))) // Deep clone
    }
  }, [settings, settingsLoading])

  // Match server: only the highest role level can update settings (e.g. registrar in default RMU setup)
  const maxRoleLevel = Math.max(0, ...(settings?.rolesConfig?.map((r) => r.level) ?? []))
  const isSuperAdmin =
    user && settings?.rolesConfig?.some((r) => r.key === user.role && r.level === maxRoleLevel)

  if (isSchoolBuild()) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || settingsLoading || !formData) {
    return (
      <>
        <div className="flex h-[50vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  if (!isSuperAdmin) {
    return (
      <>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You need super admin privileges to access organization settings.</p>
          </CardContent>
        </Card>
      </>
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // API expects a partial object, we just send all formData keys
      await settingsApi.update({
        organizationName: formData.organizationName,
        primaryColor: formData.primaryColor,
        accentColor: formData.accentColor,
        rolesConfig: formData.rolesConfig,
        ticketTypesConfig: formData.ticketTypesConfig,
        statusLabelsConfig: formData.statusLabelsConfig,
        escalationConfig: formData.escalationConfig,
        allowedEmailDomains: formData.allowedEmailDomains,
        groupPrefixes: formData.groupPrefixes,
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

  const handleAddRole = () => {
    const defaultLabel = "Advisor"
    const newRoles = [...formData.rolesConfig]
    newRoles.push({
      key: suggestUniqueRoleKey(newRoles, defaultLabel),
      label: defaultLabel,
      level: 1,
      isSubmitter: false,
      groupScoped: true,
    })
    setFormData({ ...formData, rolesConfig: newRoles })
  }

  const handleRemoveRole = (idx: number) => {
    const newRoles = [...formData.rolesConfig]
    newRoles.splice(idx, 1)
    setFormData({ ...formData, rolesConfig: newRoles })
  }

  // Domain Config Handlers
  const handleAddDomain = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
      e.preventDefault()
      const domain = e.currentTarget.value.trim().toLowerCase()
      if (!formData.allowedEmailDomains.includes(domain)) {
        setFormData({ 
          ...formData, 
          allowedEmailDomains: [...formData.allowedEmailDomains, domain] 
        })
      }
      e.currentTarget.value = ''
    }
  }

  const handleRemoveDomain = (domain: string) => {
    setFormData({
      ...formData,
      allowedEmailDomains: formData.allowedEmailDomains.filter(d => d !== domain)
    })
  }

  // Group Prefix Handlers
  const handleAddGroupCategory = () => {
    const newPrefixes = { ...formData.groupPrefixes }
    newPrefixes[`New Category ${Object.keys(newPrefixes).length + 1}`] = []
    setFormData({ ...formData, groupPrefixes: newPrefixes })
  }

  const handleUpdateGroupCategoryName = (oldName: string, newName: string) => {
    if (oldName === newName || newName.trim() === '') return
    const newPrefixes = { ...formData.groupPrefixes }
    newPrefixes[newName] = newPrefixes[oldName]
    delete newPrefixes[oldName]
    setFormData({ ...formData, groupPrefixes: newPrefixes })
  }

  const handleAddGroupItem = (category: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
      e.preventDefault()
      const item = e.currentTarget.value.trim()
      const newPrefixes = { ...formData.groupPrefixes }
      if (!newPrefixes[category].includes(item)) {
        newPrefixes[category] = [...newPrefixes[category], item]
        setFormData({ ...formData, groupPrefixes: newPrefixes })
      }
      e.currentTarget.value = ''
    }
  }

  const handleRemoveGroupItem = (category: string, itemIdx: number) => {
    const newPrefixes = { ...formData.groupPrefixes }
    newPrefixes[category].splice(itemIdx, 1)
    setFormData({ ...formData, groupPrefixes: newPrefixes })
  }

  // Status Handlers
  const handleAddStatus = () => {
    const newStatuses = [...formData.statusLabelsConfig]
    newStatuses.push({
      key: `status_${Date.now()}`,
      label: "New Status",
      color: "#6b7280"
    })
    setFormData({ ...formData, statusLabelsConfig: newStatuses })
  }

  return (
    <>
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
            <TabsTrigger value="access" className="flex-1 sm:flex-none min-w-[120px] py-2.5">
              <Shield className="w-4 h-4 mr-2" /> Access Constraints
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex-1 sm:flex-none min-w-[120px] py-2.5">
              <GitMerge className="w-4 h-4 mr-2" /> Workflow Engine
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
                      <Label>Logo</Label>
                      <p className="text-sm text-muted-foreground">
                        The app uses the static file <code className="text-xs bg-muted px-1 rounded">public/logo.png</code>. Replace that file in the project to change the logo everywhere.
                      </p>
                      <Image
                        src="/logo.png"
                        alt=""
                        width={56}
                        height={56}
                        className="mt-2 rounded-md object-contain border bg-background p-1"
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
              </TabsContent>

              <TabsContent value="roles" className="m-0 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground pr-4">
                      Define the actors (roles) in your system. Level 0 is typically the submitter. Higher levels indicate higher escalation authority. There must always be at least one submitter role. For staff roles, turn off &quot;Requires department&quot; only for school-wide roles (e.g. registrar) who are not tied to a single department.
                    </p>
                    <Button onClick={handleAddRole} size="sm" variant="outline" className="flex-shrink-0">
                      + Add Role
                    </Button>
                  </div>

                  <div className="rounded-md border">
                    <div className="grid grid-cols-12 gap-4 border-b bg-muted/50 p-3 text-sm font-medium items-center text-center sm:text-left">
                      <div className="col-span-12 sm:col-span-4">Display name</div>
                      <div className="col-span-12 sm:col-span-3">
                        Internal key
                        <span className="block text-xs font-normal text-muted-foreground font-sans">API / database id</span>
                      </div>
                      <div className="col-span-12 sm:col-span-2">Level</div>
                      <div className="col-span-12 sm:col-span-3">Actions</div>
                    </div>
                    
                    {formData.rolesConfig.map((role, idx) => (
                      <div key={idx} className="grid grid-cols-12 items-center gap-4 p-3 border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <div className="col-span-12 sm:col-span-4">
                          <Input 
                            value={role.label} 
                            onChange={e => {
                              const newRoles = [...formData.rolesConfig]
                              newRoles[idx].label = e.target.value
                              setFormData({ ...formData, rolesConfig: newRoles })
                            }}
                            className="w-full font-medium"
                            placeholder="e.g. Class Advisor"
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-3">
                          <Input 
                            value={role.key} 
                            onChange={e => {
                              const newRoles = [...formData.rolesConfig]
                              newRoles[idx].key = e.target.value
                              setFormData({ ...formData, rolesConfig: newRoles })
                            }}
                            disabled={role.key === "student" || role.key === "submitter"}
                            className="font-mono text-xs w-full"
                            placeholder="e.g. class_advisor"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-2 flex justify-center sm:justify-start">
                          <Input 
                            type="number"
                            min="0"
                            value={role.level} 
                            onChange={e => {
                              const newRoles = [...formData.rolesConfig]
                              newRoles[idx].level = parseInt(e.target.value) || 0
                              setFormData({ ...formData, rolesConfig: newRoles })
                            }}
                            className="w-full sm:w-20 text-center"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-3 flex flex-col items-end justify-center gap-2 text-xs">
                          <div className="text-muted-foreground hidden lg:block w-full text-right">
                            <div>{role.isSubmitter ? "✅ Submitter" : "❌ Staff"}</div>
                          </div>
                          {!role.isSubmitter && (
                            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer max-w-full justify-end">
                              <input
                                type="checkbox"
                                className="rounded border-border shrink-0"
                                checked={role.groupScoped !== false}
                                onChange={(e) => {
                                  const newRoles = [...formData.rolesConfig]
                                  newRoles[idx].groupScoped = e.target.checked
                                  setFormData({ ...formData, rolesConfig: newRoles })
                                }}
                              />
                              <span className="text-left">Requires department</span>
                            </label>
                          )}
                          {!(role.key === "student" || role.key === "submitter") && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveRole(idx)}
                              className="h-8 px-2 w-full sm:w-auto"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="types" className="m-0 mt-4">
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
              </TabsContent>

              <TabsContent value="access" className="m-0 mt-4">
                <div className="space-y-8">
                  {/* Allowed Domains */}
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg font-medium">Allowed Email Domains</h3>
                      <p className="text-sm text-muted-foreground">Restrict registration to specific email domains (e.g. <code>st.rmu.edu.gh</code>). Leave empty to allow any email.</p>
                    </div>
                    <div className="flex flex-col gap-3 p-4 border rounded-md bg-muted/20">
                      <div className="flex flex-wrap gap-2">
                        {formData.allowedEmailDomains.length === 0 && (
                          <span className="text-sm text-muted-foreground italic">No domains configured. Any email can register.</span>
                        )}
                        {formData.allowedEmailDomains.map((domain) => (
                          <Badge key={domain} variant="secondary" className="px-3 py-1 flex items-center gap-1 text-sm bg-background border">
                            @{domain}
                            <button 
                              onClick={() => handleRemoveDomain(domain)}
                              className="ml-1 hover:text-destructive text-muted-foreground"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="max-w-md">
                        <Input 
                          placeholder="Type a domain and press Enter (e.g. rmu.edu.gh)" 
                          onKeyDown={handleAddDomain}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Department list (stored as groupPrefixes) */}
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Departments</h3>
                        <p className="text-sm text-muted-foreground">
                          Define departments for your school (e.g. Information Technology → index prefixes BIT, DIT, BCS). Students and staff select their department when registering.
                        </p>
                      </div>
                      <Button onClick={handleAddGroupCategory} size="sm" variant="outline">
                        + Add department
                      </Button>
                    </div>
                    <div className="grid gap-6">
                      {Object.entries(formData.groupPrefixes).length === 0 && (
                        <div className="p-4 border rounded-md bg-muted/20 text-center text-sm text-muted-foreground">
                          No departments configured in saved settings. The API still falls back to default RMU departments until you add or save departments here.
                        </div>
                      )}
                      
                      {Object.entries(formData.groupPrefixes).map(([category, items], catIdx) => (
                        <Card key={catIdx}>
                          <CardHeader className="p-4 pb-2 bg-muted/30 border-b flex flex-row items-center justify-between">
                            <Input 
                              defaultValue={category}
                              onBlur={(e) => handleUpdateGroupCategoryName(category, e.target.value)}
                              className="h-8 w-64 bg-background font-medium"
                            />
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive h-8 px-2"
                              onClick={() => {
                                const newPrefs = {...formData.groupPrefixes};
                                delete newPrefs[category];
                                setFormData({...formData, groupPrefixes: newPrefs});
                              }}
                            >
                              Remove department
                            </Button>
                          </CardHeader>
                          <CardContent className="p-4">
                            <div className="flex flex-wrap gap-2 mb-3">
                              {items.map((item, idx) => (
                                <Badge key={idx} variant="outline" className="px-2 py-1 flex items-center gap-1 bg-background font-normal">
                                  {item}
                                  <button 
                                    onClick={() => handleRemoveGroupItem(category, idx)}
                                    className="ml-1 text-muted-foreground hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                </Badge>
                              ))}
                              {items.length === 0 && (
                                <span className="text-sm text-muted-foreground italic">No items added to this category yet.</span>
                              )}
                            </div>
                            <div className="max-w-sm">
                              <Input 
                                placeholder={`Add item to ${category} and press Enter`} 
                                onKeyDown={(e) => handleAddGroupItem(category, e)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="workflow" className="m-0 mt-4">
                <div className="space-y-8">
                  {/* Status Labels */}
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Status Pipeline</h3>
                        <p className="text-sm text-muted-foreground">Define what states a ticket can exist in.</p>
                      </div>
                      <Button onClick={handleAddStatus} size="sm" variant="outline">
                        + Add Status
                      </Button>
                    </div>
                    
                    <div className="rounded-md border">
                      <div className="grid grid-cols-12 gap-4 border-b bg-muted/50 p-3 text-sm font-medium">
                        <div className="col-span-4">Status Key</div>
                        <div className="col-span-4">Display Label</div>
                        <div className="col-span-3">Theme Color</div>
                        <div className="col-span-1"></div>
                      </div>
                      {formData.statusLabelsConfig.map((status, idx) => (
                        <div key={idx} className="grid grid-cols-12 items-center gap-4 p-3 border-b last:border-0 hover:bg-muted/20">
                          <div className="col-span-4">
                            <Input 
                              value={status.key} 
                              onChange={e => {
                                const newStat = [...formData.statusLabelsConfig]
                                newStat[idx].key = e.target.value
                                setFormData({ ...formData, statusLabelsConfig: newStat })
                              }}
                              disabled={status.key === "submitted" || status.key === "resolved" || status.key === "rejected"}
                              className="text-xs font-mono h-8"
                            />
                          </div>
                          <div className="col-span-4">
                            <Input 
                              value={status.label} 
                              onChange={e => {
                                const newStat = [...formData.statusLabelsConfig]
                                newStat[idx].label = e.target.value
                                setFormData({ ...formData, statusLabelsConfig: newStat })
                              }}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="col-span-3 flex items-center gap-2">
                            <input 
                              type="color" 
                              value={status.color} 
                              onChange={e => {
                                const newStat = [...formData.statusLabelsConfig]
                                newStat[idx].color = e.target.value
                                setFormData({ ...formData, statusLabelsConfig: newStat })
                              }}
                              className="h-8 w-12 cursor-pointer p-0 border-0 rounded"
                            />
                            <span className="text-xs font-mono text-muted-foreground">{status.color}</span>
                          </div>
                          <div className="col-span-1 text-right">
                            {!(status.key === "submitted" || status.key === "resolved" || status.key === "rejected") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newStat = [...formData.statusLabelsConfig]
                                  newStat.splice(idx, 1)
                                  setFormData({ ...formData, statusLabelsConfig: newStat })
                                }}
                                className="h-8 px-2 text-destructive hover:bg-destructive/10"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Escalation Rules */}
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg font-medium">Escalation Workflows</h3>
                      <p className="text-sm text-muted-foreground">Advanced setting: Map which roles get notified/assigned when a ticket moves to a specific status.</p>
                      <p className="text-xs text-muted-foreground mt-1 px-3 py-2 bg-muted/50 rounded-md border inline-block">
                        Escalation UI configuration is currently managed via database seed files for complex relational integrity.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </>
  )
}
