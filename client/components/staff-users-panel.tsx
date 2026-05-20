"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSettings } from "@/lib/settings-context"
import { usersApi, type StaffUserRecord } from "@/lib/api"
import { registrationRoleRequiresGroup } from "@/lib/validation"
import { departmentSelectOptions } from "@/lib/rmu-departments"
import { REGISTRATION_PASSWORD_HINT } from "@/lib/password-policy"
import { PasswordStrengthMeter } from "@/components/password-strength-meter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"

const STAFF_FORM_DEFAULT = {
  name: "",
  email: "",
  password: "",
  role: "advisor",
  group: "",
}

export function StaffUsersPanel() {
  const { settings, getRoleLabel: getRoleLabelFromSettings } = useSettings()
  const [staff, setStaff] = useState<StaffUserRecord[]>([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(STAFF_FORM_DEFAULT)

  const staffRoleOptions = useMemo(
    () => (settings?.rolesConfig ?? []).filter((r) => !r.isSubmitter),
    [settings?.rolesConfig]
  )

  const staffSettingsContext = useMemo(
    () => ({
      rolesConfig: staffRoleOptions,
      allowedEmailDomains: settings?.allowedEmailDomains ?? [],
      groupPrefixes: settings?.groupPrefixes,
    }),
    [staffRoleOptions, settings?.allowedEmailDomains, settings?.groupPrefixes]
  )

  const needsDepartment = registrationRoleRequiresGroup(form.role, staffSettingsContext)
  const departments = departmentSelectOptions(settings?.groupPrefixes)

  const loadStaff = useCallback(async () => {
    setIsLoadingList(true)
    try {
      const res = await usersApi.listStaff()
      setStaff(res.data)
    } catch {
      toast.error("Failed to load staff accounts")
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error("Please fill in all required fields")
      return
    }
    if (needsDepartment && !form.group.trim()) {
      toast.error("Department is required for this role")
      return
    }

    setIsSubmitting(true)
    try {
      await usersApi.createStaff({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        group: needsDepartment ? form.group.trim() : undefined,
      })
      toast.success("Staff account created", {
        description: `${form.name} can sign in with the email and password you set.`,
      })
      setForm({ ...STAFF_FORM_DEFAULT, role: form.role })
      await loadStaff()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleLabel = (role: string) => getRoleLabelFromSettings(role)

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">Create staff account</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add advisors, heads of department, and registrars without using the database or seed script.
          Accounts are created with a verified email so they can sign in immediately.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2 p-4 border rounded-lg bg-muted/20"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="staff-name">Full name</Label>
          <Input
            id="staff-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Dr. Jane Smith"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="name@rmu.edu.gh"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="staff-role">Role</Label>
          <Select
            value={form.role}
            onValueChange={(role) => setForm({ ...form, role, group: "" })}
          >
            <SelectTrigger id="staff-role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {staffRoleOptions.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsDepartment && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="staff-group">Department</Label>
            <Select
              value={form.group || undefined}
              onValueChange={(group) => setForm({ ...form, group })}
            >
              <SelectTrigger id="staff-group">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="staff-password">Temporary password</Label>
          <Input
            id="staff-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Set an initial password"
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{REGISTRATION_PASSWORD_HINT}</p>
          <PasswordStrengthMeter password={form.password} />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Creating…" : "Create account"}
          </Button>
        </div>
      </form>

      <div>
        <h3 className="text-lg font-medium mb-3">Existing staff accounts</h3>
        {isLoadingList ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No staff accounts yet.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.group ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
