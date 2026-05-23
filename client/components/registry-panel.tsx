"use client"

import { useCallback, useEffect, useState } from "react"
import { registryApi } from "@/lib/api"
import { departmentSelectOptions } from "@/lib/rmu-departments"
import { useSettings } from "@/lib/settings-context"
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
import { Pagination } from "@/components/ui/pagination"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

export function RegistryPanel() {
  const { settings } = useSettings()
  const [rows, setRows] = useState<
    Array<{
      id: string
      memberType: string
      studentId: string
      fullName: string
      department: string
      email: string | null
      level: string | null
    }>
  >([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  })
  const [search, setSearch] = useState("")
  const [memberType, setMemberType] = useState<string>("all")
  const [department, setDepartment] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [csvText, setCsvText] = useState("")
  const [form, setForm] = useState({
    memberType: "student",
    studentId: "",
    fullName: "",
    department: "",
    email: "",
    level: "",
  })

  const departments = departmentSelectOptions(settings?.groupPrefixes)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await registryApi.list({
        page,
        limit: 10,
        search: search || undefined,
        memberType: memberType === "all" ? undefined : memberType,
        department: department === "all" ? undefined : department,
      })
      setRows(res.data)
      setPagination({
        totalPages: res.pagination.totalPages,
        hasNext: res.pagination.hasNext,
        hasPrev: res.pagination.hasPrev,
      })
    } catch {
      toast.error("Failed to load registry")
    } finally {
      setIsLoading(false)
    }
  }, [page, search, memberType, department])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await registryApi.create({
        memberType: form.memberType,
        studentId: form.studentId,
        fullName: form.fullName,
        department: form.department,
        email: form.email || undefined,
        level: form.level || undefined,
      })
      toast.success("Registry entry added")
      setForm({ memberType: "student", studentId: "", fullName: "", department: "", email: "", level: "" })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add entry")
    }
  }

  const handleBulk = async () => {
    if (!csvText.trim()) {
      toast.error("Paste CSV content first")
      return
    }
    try {
      const res = await registryApi.bulkUpload(csvText)
      toast.success(`Upload done: ${res.created} created, ${res.updated} updated`)
      setCsvText("")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk upload failed")
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">Student &amp; alumni registry</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Official list used at registration instead of JSON files. CSV columns: memberType, studentId, fullName, department, email, level.
        </p>
      </div>

      <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4 border rounded-lg bg-muted/20">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.memberType} onValueChange={(v) => setForm({ ...form, memberType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="alumni">Alumni</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>ID</Label>
          <Input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Department</Label>
          <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
            <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Email (optional)</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Level (optional)</Label>
          <Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="L100" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit"><Plus className="mr-2 h-4 w-4" />Add to registry</Button>
        </div>
      </form>

      <div className="space-y-2 p-4 border rounded-lg">
        <Label>Bulk upload (CSV)</Label>
        <Textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="memberType,studentId,fullName,department,email,level&#10;student,BIT0001526,Jane Doe,ICT,jane@st.rmu.edu.gh,L100"
          rows={4}
        />
        <Button type="button" variant="secondary" onClick={handleBulk}>
          <Upload className="mr-2 h-4 w-4" />Upload CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search name or ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
        <Select value={memberType} onValueChange={(v) => { setMemberType(v); setPage(1) }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="alumni">Alumni</SelectItem>
          </SelectContent>
        </Select>
        <Select value={department} onValueChange={(v) => { setDepartment(v); setPage(1) }}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize">{r.memberType}</TableCell>
                    <TableCell className="font-mono text-xs">{r.studentId}</TableCell>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell>{r.department}</TableCell>
                    <TableCell>{r.level ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={async () => {
                          if (!confirm("Remove this registry entry?")) return
                          await registryApi.remove(r.id)
                          toast.success("Removed")
                          await load()
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pagination.totalPages > 1 && (
            <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} hasNext={pagination.hasNext} hasPrev={pagination.hasPrev} />
          )}
        </>
      )}
    </div>
  )
}
