import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase environment variables not set. File uploads will not work."
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Supabase Storage bucket name (must match bucket created in Supabase dashboard). */
export const PETITION_ATTACHMENTS_BUCKET = "petition-attachments"

