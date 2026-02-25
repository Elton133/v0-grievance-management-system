import { supabase, TICKET_ATTACHMENTS_BUCKET } from "./supabase"

export interface UploadedFile {
  url: string
  fileName: string
  fileSize: number
  mimeType: string
}

/**
 * Upload a file to Supabase Storage
 * @param file - File object from input
 * @param ticketId - ID of the ticket
 * @param userId - ID of the user uploading
 * @returns Uploaded file info or null if upload fails
 */
export async function uploadFileToSupabase(
  file: File,
  ticketId: string,
  userId: string
): Promise<UploadedFile | null> {
  try {
    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
    }

    // Validate file type
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
    if (!allowedTypes.includes(file.type)) {
      throw new Error("File type not allowed")
    }

    // Create a unique file path
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filePath = `tickets/${ticketId}/${userId}/${timestamp}-${sanitizedFileName}`

    // Upload file
    const { data, error } = await supabase.storage
      .from(TICKET_ATTACHMENTS_BUCKET)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error("Error uploading file:", error)
      throw error
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(TICKET_ATTACHMENTS_BUCKET).getPublicUrl(filePath)

    return {
      url: publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }
  } catch (error) {
    console.error("Error in uploadFileToSupabase:", error)
    return null
  }
}

/**
 * Delete a file from Supabase Storage
 * @param filePath - Path of the file to delete
 */
export async function deleteFileFromSupabase(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(TICKET_ATTACHMENTS_BUCKET)
      .remove([filePath])

    if (error) {
      console.error("Error deleting file:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error in deleteFileFromSupabase:", error)
    return false
  }
}

