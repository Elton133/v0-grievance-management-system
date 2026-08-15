"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2, Plus, Users, FileText, Inbox } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { platformApi, type PlatformOrganization, type WorkspaceRequest } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function PlatformPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([])
  const [requests, setRequests] = useState<WorkspaceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [orgs, leads] = await Promise.all([platformApi.organizations(), platformApi.workspaceRequests()])
      setOrganizations(orgs.data)
      setRequests(leads.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load platform data")
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user?.isPlatformOwner) { router.replace("/admin"); return }
    void load()
  }, [user, authLoading, router])

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    try {
      await platformApi.createOrganization(data)
      toast.success("Institution workspace created")
      form.reset()
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create workspace")
    } finally { setCreating(false) }
  }

  if (authLoading || loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="size-7 animate-spin text-muted-foreground" /></div>
  if (!user?.isPlatformOwner) return null

  const active = organizations.filter(org => org.status === "active").length
  const users = organizations.reduce((sum, org) => sum + org._count.users, 0)
  const tickets = organizations.reduce((sum, org) => sum + org._count.tickets, 0)
  const stats: Array<{ icon: LucideIcon; label: string; value: number }> = [
    { icon: Building2, label: "Institutions", value: organizations.length },
    { icon: Building2, label: "Active", value: active },
    { icon: Users, label: "Users", value: users },
    { icon: FileText, label: "Cases", value: tickets },
  ]

  return <div className="mx-auto max-w-7xl space-y-8">
    <div><p className="text-sm font-medium text-primary">Platform owner</p><h1 className="text-3xl font-bold tracking-tight">Institution management</h1><p className="mt-2 text-muted-foreground">Create and manage isolated workspaces across the Resolve platform.</p></div>
    <div className="grid gap-4 sm:grid-cols-4">
      {stats.map(({ icon: Icon, label, value }) => <Card key={label}><CardContent className="flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>)}
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <Card><CardHeader><CardTitle>Institutions</CardTitle></CardHeader><CardContent className="space-y-3">{organizations.map(org => <div key={org.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-medium">{org.name}</p><span className={`rounded-full px-2 py-0.5 text-xs ${org.status === "active" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{org.status}</span></div><p className="text-sm text-muted-foreground">{org.slug} · {org.subscriptionTier}</p></div><div className="text-sm text-muted-foreground">{org._count.users} users · {org._count.tickets} cases</div><Button size="sm" variant="outline" onClick={async () => { await platformApi.updateOrganization(org.id, { status: org.status === "active" ? "suspended" : "active" }); await load() }}>{org.status === "active" ? "Suspend" : "Activate"}</Button></div>)}{organizations.length === 0 && <p className="py-10 text-center text-muted-foreground">No institutions yet.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5" />Create workspace</CardTitle></CardHeader><CardContent><form onSubmit={createWorkspace} className="space-y-4"><Field name="name" label="Institution name"/><Field name="slug" label="Workspace slug"/><Field name="adminName" label="Administrator name"/><Field name="adminEmail" label="Administrator email" type="email"/><Field name="adminPassword" label="Temporary password" type="password"/><Button className="w-full" disabled={creating}>{creating ? <Loader2 className="animate-spin"/> : <Plus/>}Create institution</Button></form></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="size-5"/>Workspace requests</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2">{requests.map(request => <div key={request.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><p className="font-medium">{request.organizationName}</p><span className="text-xs text-muted-foreground">{request.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{request.contactName} · {request.contactEmail}</p><p className="mt-3 text-sm">Preferred workspace: <strong>{request.preferredSlug}</strong></p>{request.message && <p className="mt-2 text-sm text-muted-foreground">{request.message}</p>}</div>)}{requests.length === 0 && <p className="py-8 text-center text-muted-foreground md:col-span-2">No workspace requests yet.</p>}</div></CardContent></Card>
  </div>
}

function Field({ name, label, type = "text" }: { name: string; label: string; type?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required /></div>
}
