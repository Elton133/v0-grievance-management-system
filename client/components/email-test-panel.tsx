"use client"

import { useCallback, useEffect, useState } from "react"
import { emailApi, type EmailConfigStatus } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, Send } from "lucide-react"
import { toast } from "sonner"

export function EmailTestPanel() {
  const [status, setStatus] = useState<EmailConfigStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [testTo, setTestTo] = useState("")
  const [isSending, setIsSending] = useState(false)

  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await emailApi.getStatus()
      setStatus(res)
    } catch {
      toast.error("Could not load email configuration")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testTo.trim()) {
      toast.error("Enter a recipient email")
      return
    }
    setIsSending(true)
    try {
      const res = await emailApi.sendTest(testTo.trim())
      toast.success(res.msg, {
        description: `Sent via ${res.provider}. Check the inbox (and spam).`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test send failed")
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading email configuration…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email delivery (demo / production)
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Resend trial only delivers to your own inbox. For defense, use{" "}
          <strong>Brevo</strong> or <strong>SendGrid</strong> in server <code className="text-xs bg-muted px-1 rounded">.env</code>{" "}
          (see <code className="text-xs bg-muted px-1 rounded">server/.env.example</code>).
        </p>
      </div>

      <div className="rounded-md border p-4 space-y-3 bg-muted/20 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Active provider:</span>
          {status?.isConfigured ? (
            <Badge>{status.provider}</Badge>
          ) : (
            <Badge variant="destructive">Not configured</Badge>
          )}
        </div>
        {status?.from && (
          <p>
            <span className="text-muted-foreground">From: </span>
            <span className="font-mono text-xs">{status.from}</span>
          </p>
        )}
        {status?.explicitProvider && (
          <p className="text-muted-foreground">
            EMAIL_PROVIDER={status.explicitProvider}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          Ready: Brevo {status?.brevo ? "✓" : "—"} · SendGrid {status?.sendgrid ? "✓" : "—"} · SMTP{" "}
          {status?.smtp ? "✓" : "—"} · Resend {status?.resend ? "✓" : "—"}
        </p>
      </div>

      <form onSubmit={handleSendTest} className="flex flex-col sm:flex-row gap-3 items-end max-w-xl">
        <div className="flex-1 space-y-2 w-full">
          <Label htmlFor="test-email-to">Send test to</Label>
          <Input
            id="test-email-to"
            type="email"
            placeholder="advisor@rmu.edu.gh or any address"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            disabled={!status?.isConfigured || isSending}
          />
        </div>
        <Button
          type="submit"
          disabled={!status?.isConfigured || isSending || !testTo.trim()}
          className="w-full sm:w-auto"
        >
          {isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send test
        </Button>
      </form>

      {!status?.isConfigured && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">
          Add Brevo credentials to <code className="text-xs">server/.env</code>, restart the API server, then refresh this page.
        </p>
      )}
    </div>
  )
}
