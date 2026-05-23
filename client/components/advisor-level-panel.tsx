"use client"

import { useCallback, useEffect, useState } from "react"
import { advisorAssignmentApi, usersApi } from "@/lib/api"
import { departmentSelectOptions } from "@/lib/rmu-departments"
import { useSettings } from "@/lib/settings-context"
import { ACADEMIC_LEVELS, PETITION_TYPES } from "@/lib/petition-form-options"
import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"

export function AdvisorLevelPanel() {
  const { settings } = useSettings()
  const [department, setDepartment] = useState("")
  const [advisors, setAdvisors] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [assignments, setAssignments] = useState<
    Array<{
      id: string
      department: string
      levels: string[]
      petitionTypes: string[]
      advisor: { id: string; name: string; email: string }
    }>
  >([])
  const [selectedAdvisorId, setSelectedAdvisorId] = useState("")
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [staffRes, assignRes] = await Promise.all([
        usersApi.listStaff(),
        advisorAssignmentApi.list(department || undefined),
      ])
      setAdvisors(
        staffRes.data
          .filter((u) => u.role === "advisor")
          .map((u) => ({ id: u.id, name: u.name, email: u.email }))
      )
      setAssignments(assignRes.data)
    } catch {
      toast.error("Failed to load advisor assignments")
    } finally {
      setIsLoading(false)
    }
  }, [department])

  useEffect(() => {
    void load()
  }, [load])

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    )
  }

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleSave = async () => {
    if (!department || !selectedAdvisorId || selectedLevels.length === 0) {
      toast.error("Select department, advisor, and at least one level")
      return
    }
    try {
      await advisorAssignmentApi.upsert({
        advisorId: selectedAdvisorId,
        department,
        levels: selectedLevels,
        petitionTypes: selectedTypes,
      })
      toast.success("Assignment saved")
      setSelectedAdvisorId("")
      setSelectedLevels([])
      setSelectedTypes([])
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await advisorAssignmentApi.remove(id)
      toast.success("Assignment removed")
      await load()
    } catch {
      toast.error("Delete failed")
    }
  }

  const deptOptions = departmentSelectOptions(settings?.groupPrefixes)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Assign class advisors to academic levels per department. Petitions from those levels route to
        the matching advisor; other levels use the default advisor for the department.
      </p>

      <div className="grid gap-4 md:grid-cols-2 max-w-xl">
        <div className="space-y-2">
          <Label>Department</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {deptOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Advisor</Label>
          <Select value={selectedAdvisorId} onValueChange={setSelectedAdvisorId} disabled={!department}>
            <SelectTrigger>
              <SelectValue placeholder="Select advisor" />
            </SelectTrigger>
            <SelectContent>
              {advisors.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Levels</Label>
        <div className="flex flex-wrap gap-3">
          {ACADEMIC_LEVELS.map((l) => (
            <label key={l.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="rounded border"
                checked={selectedLevels.includes(l.value)}
                onChange={() => toggleLevel(l.value)}
              />
              {l.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Petition types (optional — empty means all types)</Label>
        <div className="flex flex-wrap gap-3">
          {PETITION_TYPES.map((t) => (
            <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="rounded border"
                checked={selectedTypes.includes(t.key)}
                onChange={() => toggleType(t.key)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={!department || isLoading}>
        Save assignment
      </Button>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead>Advisor</TableHead>
              <TableHead>Levels</TableHead>
              <TableHead>Types</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.department}</TableCell>
                <TableCell>{row.advisor.name}</TableCell>
                <TableCell>{row.levels.join(", ")}</TableCell>
                <TableCell>
                  {row.petitionTypes.length ? row.petitionTypes.join(", ") : "All"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
