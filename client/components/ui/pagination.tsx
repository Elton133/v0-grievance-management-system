"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  hasNext: boolean
  hasPrev: boolean
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  hasNext,
  hasPrev,
}: PaginationProps) {
  const handlePrevious = () => {
    if (hasPrev) {
      onPageChange(page - 1)
    }
  }

  const handleNext = () => {
    if (hasNext) {
      onPageChange(page + 1)
    }
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={!hasPrev}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

