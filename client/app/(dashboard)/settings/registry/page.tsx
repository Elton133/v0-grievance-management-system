"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { isSystemAdminRole } from "@/lib/role-utils"
import { RegistryPanel } from "@/components/registry-panel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield } from "lucide-react"

export default function RegistryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { isSubmitterRole } = useSettings()

  useEffect(() => {
    if (!user) return
    if (isSubmitterRole(user.role)) router.replace("/dashboard")
    else if (!isSystemAdminRole(user.role)) router.replace("/admin")
  }, [user, router, isSubmitterRole])

  if (!user || !isSystemAdminRole(user.role)) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="pt-6 text-center">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Only system administrators can manage the registry.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <RegistryPanel />
        </CardContent>
      </Card>
    </div>
  )
}
