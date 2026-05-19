"use client"

import type { PetitionAttachment } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { FileText, ImageIcon, File, ExternalLink, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"

interface PetitionAttachmentsProps {
  attachments?: PetitionAttachment[]
  className?: string
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageMime(mimeType?: string): boolean {
  return Boolean(mimeType?.startsWith("image/"))
}

function AttachmentIcon({ mimeType }: { mimeType?: string }) {
  if (isImageMime(mimeType)) {
    return <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  }
  if (mimeType === "application/pdf") {
    return <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  }
  return <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
}

export function PetitionAttachments({ attachments = [], className }: PetitionAttachmentsProps) {
  if (attachments.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <h3 className="font-semibold flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Petition attachments
        </h3>
        <p className="text-sm text-muted-foreground">No petition attachments were submitted.</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="font-semibold flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Petition attachments ({attachments.length})
      </h3>
      <div className="space-y-3">
        {attachments.map((attachment) => {
          const isImage = isImageMime(attachment.mimeType)
          const sizeLabel = formatFileSize(attachment.fileSize)

          return (
            <div
              key={attachment.id}
              className="rounded-lg border bg-muted/30 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <AttachmentIcon mimeType={attachment.mimeType} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[sizeLabel, attachment.uploadedAt.toLocaleDateString()]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="flex-shrink-0" asChild>
                  <a
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={attachment.fileName}
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Open
                  </a>
                </Button>
              </div>
              {isImage && (
                <a
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border-t bg-background"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.fileUrl}
                    alt={attachment.fileName}
                    className="max-h-64 w-full object-contain"
                  />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
