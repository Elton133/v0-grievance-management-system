import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "⚠️ Supabase environment variables not set. File operations will not work."
  )
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Storage bucket name for ticket attachments
export const TICKET_ATTACHMENTS_BUCKET = "ticket-attachments"

/**
 * Upload a file to Supabase Storage
 * @param file - File buffer or base64 string
 * @param fileName - Name of the file
 * @param ticketId - ID of the ticket
 * @param userId - ID of the user uploading
 * @returns File URL or null if upload fails
 */
export async function uploadFile(
  file: Buffer | string,
  fileName: string,
  ticketId: string,
  userId: string
): Promise<{ url: string; path: string } | null> {
  try {
    // Create a unique file path: tickets/{ticketId}/{userId}/{timestamp}-{fileName}
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filePath = `tickets/${ticketId}/${userId}/${timestamp}-${sanitizedFileName}`

    // Upload file
    const { data, error } = await supabase.storage
      .from(TICKET_ATTACHMENTS_BUCKET)
      .upload(filePath, file, {
        contentType: "application/octet-stream",
        upsert: false,
      })

    if (error) {
      console.error("Error uploading file:", error)
      return null
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(TICKET_ATTACHMENTS_BUCKET).getPublicUrl(filePath)

    return {
      url: publicUrl,
      path: filePath,
    }
  } catch (error) {
    console.error("Error in uploadFile:", error)
    return null
  }
}

/**
 * Delete a file from Supabase Storage
 * @param filePath - Path of the file to delete
 */
export async function deleteFile(filePath: string): Promise<boolean> {
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
    console.error("Error in deleteFile:", error)
    return false
  }
}

