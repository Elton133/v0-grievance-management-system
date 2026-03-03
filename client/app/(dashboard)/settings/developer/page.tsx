"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { Shield, Key, Webhook, Plus, Trash2, Code2, Copy, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { developerApi } from "@/lib/api"
import { format } from "date-fns"

interface ApiKey {
  id: string
  name: string
  createdAt: string
  lastUsed?: string
}

interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  isActive: boolean
  createdAt: string
}

export default function DeveloperSettingsPage() {
  const { user } = useAuth()

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [newKeyName, setNewKeyName] = useState("")
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null)
  const [isCreatingKey, setIsCreatingKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  const [newWebhookUrl, setNewWebhookUrl] = useState("")
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false)

  useEffect(() => {
    void fetchDeveloperData()
  }, [])

  const fetchDeveloperData = async () => {
    setIsLoading(true)
    try {
      const [keysRes, hooksRes] = await Promise.all([developerApi.getKeys(), developerApi.getWebhooks()])
      setApiKeys(keysRes || [])
      setWebhooks(hooksRes || [])
    } catch (error) {
      console.error("Failed to fetch developer data:", error)
      toast.error("Failed to load developer settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API Key")
      return
    }

    setIsCreatingKey(true)
    try {
      const response = await developerApi.createKey(newKeyName)
      setApiKeys([response, ...apiKeys])
      setNewKeySecret(response.token)
      setNewKeyName("")
      toast.success("API Key created successfully")
    } catch (error) {
      toast.error("Failed to create API key")
    } finally {
      setIsCreatingKey(false)
    }
  }

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Any applications using it will immediately lose access."))
      return

    try {
      await developerApi.revokeKey(id)
      setApiKeys(apiKeys.filter((k) => k.id !== id))
      toast.success("API Key revoked")
    } catch (error) {
      toast.error("Failed to revoke API key")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
    toast.success("Copied to clipboard")
  }

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim() || !newWebhookUrl.startsWith("http")) {
      toast.error("Please enter a valid HTTPS URL")
      return
    }

    setIsCreatingWebhook(true)
    try {
      const response = await developerApi.createWebhook({
        url: newWebhookUrl,
        events: ["*"],
      })
      setWebhooks([response, ...webhooks])
      setNewWebhookUrl("")
      toast.success("Webhook endpoint registered")
    } catch (error) {
      toast.error("Failed to create webhook")
    } finally {
      setIsCreatingWebhook(false)
    }
  }

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook endpoint?")) return

    try {
      await developerApi.deleteWebhook(id)
      setWebhooks(webhooks.filter((w) => w.id !== id))
      toast.success("Webhook deleted")
    } catch (error) {
      toast.error("Failed to delete webhook")
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        Loading Developer Settings...
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Developer Settings</h2>
        <p className="text-muted-foreground">
          Manage API keys and Webhooks to integrate the platform with external systems.
        </p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="api-keys">
            <Key className="w-4 h-4 mr-2" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="w-4 h-4 mr-2" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="docs">
            <Code2 className="w-4 h-4 mr-2" /> API Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4 m-0">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Generate tokens to authenticate programmatically against the platform&apos;s REST API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {newKeySecret && (
                <div className="p-4 border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 rounded-md">
                  <h4 className="font-semibold text-green-800 dark:text-green-400 mb-2 flex items-center">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> Key Created Successfully
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-500 mb-3">
                    Please copy this key and store it somewhere safe. For security reasons,{" "}
                    <strong>we cannot show it to you again</strong>.
                  </p>
                  <div className="flex gap-2">
                    <Input value={newKeySecret} readOnly className="font-mono bg-white dark:bg-black" />
                    <Button variant="secondary" onClick={() => copyToClipboard(newKeySecret)}>
                      {copiedKey ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-end gap-4 pb-6 border-b">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="keyName">New Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g. Student Portal Integration Production"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreateApiKey} disabled={isCreatingKey || !newKeyName}>
                  <Plus className="w-4 h-4 mr-2" /> Generate Key
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Active API Keys</h4>
                {apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No API keys have been generated yet.</p>
                ) : (
                  <div className="rounded-md border divide-y">
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {key.name}
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                              gms_live_••••••
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Created on {format(new Date(key.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeApiKey(key.id)}
                          className="text-destructive hover:bg-destructive/10 self-start sm:self-auto"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4 m-0">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Endpoints</CardTitle>
              <CardDescription>
                Register HTTPS URLs to receive real-time push events when changes happen in the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 pb-6 border-b">
                <div className="flex-1 space-y-2 w-full">
                  <Label htmlFor="webhookUrl">Endpoint URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://your-service.com/webhooks/gms"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreateWebhook}
                  disabled={isCreatingWebhook || !newWebhookUrl}
                  className="w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Endpoint
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Configured Endpoints</h4>
                {webhooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No webhooks have been registered.</p>
                ) : (
                  <div className="grid gap-4">
                    {webhooks.map((hook) => (
                      <div
                        key={hook.id}
                        className="p-4 rounded-md border bg-card flex flex-col sm:flex-row justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1 overflow-hidden">
                          <div className="flex items-center gap-2">
                            {hook.isActive ? (
                              <span className="flex h-2 w-2 rounded-full bg-green-500" />
                            ) : (
                              <span className="flex h-2 w-2 rounded-full bg-red-500" />
                            )}
                            <span className="font-mono text-sm truncate">{hook.url}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {hook.events.map((ev) => (
                              <Badge key={ev} variant="secondary">
                                {ev === "*" ? "All Events" : ev}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Added {format(new Date(hook.createdAt), "PP")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWebhook(hook.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4 m-0">
          <Card>
            <CardHeader>
              <CardTitle>API Quickstart</CardTitle>
              <CardDescription>Learn how to interact with the Platform API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Authentication</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  All API requests must be authenticated via an API key passed in the Authorization header as a Bearer
                  token.
                </p>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
                  Authorization: Bearer gms_live_YOUR_API_KEY_HERE
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-2">Create a Ticket</h4>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
{`curl -X POST https://api.yourdomain.com/api/v1/tickets \\
  -H "Authorization: Bearer gms_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "submitterEmail": "student@rmu.edu.gh",
    "submitterName": "John Doe",
    "subject": "Missing Desktop in Lab B",
    "description": "The desktop terminal at row 2 is missing.",
    "type": "facility_issue",
    "priority": "high",
    "group": "Computer Science"
}'`}
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-2">Webhook Payloads</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  When events occur, your webhook endpoints will receive a POST request with a JSON body:
                </p>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
{`{
  "id": "evt_abc123...",
  "type": "ticket.created",
  "created_at": "1678901234",
  "data": {
    "id": "clkj1234...",
    "subject": "Missing Desktop in Lab B",
    "status": "submitted"
    // ... Full ticket object
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
