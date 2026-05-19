import { ticketApi } from "./api"

const MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"))
        return
      }
      const base64 = result.includes(",") ? result.split(",")[1]! : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

/** Upload one petition attachment through the API (server stores in Supabase with service role). */
export async function uploadPetitionAttachment(ticketId: string, file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} exceeds the 10MB limit`)
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`${file.name} has an unsupported file type`)
  }

  const data = await readFileAsBase64(file)
  return ticketApi.uploadAttachment(ticketId, {
    fileName: file.name,
    mimeType: file.type,
    data,
  })
}

/** Upload multiple files; returns successes and per-file errors. */
export async function uploadPetitionAttachments(
  ticketId: string,
  files: File[]
): Promise<{ uploaded: number; errors: string[] }> {
  const errors: string[] = []
  let uploaded = 0

  for (const file of files) {
    try {
      await uploadPetitionAttachment(ticketId, file)
      uploaded += 1
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      errors.push(`${file.name}: ${msg}`)
    }
  }

  return { uploaded, errors }
}
