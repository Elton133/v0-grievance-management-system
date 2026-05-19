export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
])

export function validateAttachmentMeta(
  fileName: string,
  mimeType: string | undefined,
  sizeBytes: number
): string | null {
  if (!fileName?.trim()) return "File name is required"
  if (sizeBytes <= 0) return "File is empty"
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    return `File exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB limit`
  }
  if (mimeType && !ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    return "File type not allowed. Use PDF, images, Word docs, or plain text."
  }
  return null
}
