"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { X, Upload, File } from "lucide-react"
import { toast } from "sonner"

interface FileUploadProps {
  onFilesChange: (files: File[]) => void
  selectedFiles: File[]
  disabled?: boolean
}

export function FileUpload({
  onFilesChange,
  selectedFiles,
  disabled = false,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Validate file sizes
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const invalidFiles = files.filter((file) => file.size > MAX_FILE_SIZE)
    
    if (invalidFiles.length > 0) {
      toast.error(`Some files exceed the 10MB limit`)
      return
    }

    // Validate file types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]
    const invalidTypes = files.filter((file) => !allowedTypes.includes(file.type))
    
    if (invalidTypes.length > 0) {
      toast.error("Some files have unsupported types. Allowed: PDF, images, Word docs, text files")
      return
    }

    onFilesChange([...selectedFiles, ...files])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Petition attachments (optional)</label>
        <p className="text-xs text-muted-foreground mb-2">
          Upload supporting files for your petition (PDF, images, Word docs). Max 10MB per file.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          Choose Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Selected Files ({selectedFiles.length})</p>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFile(index)}
                  disabled={disabled}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
