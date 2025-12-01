import { randomUUID } from 'crypto'
import { getServiceRoleClient } from '@/lib/db/client'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

const BUCKET_NAME = 'idea-attachments'

export interface SignedUploadUrl {
  uploadUrl: string
  path: string
  expiresIn: number
}

/**
 * Server-side helper: validate file metadata and generate a signed upload URL
 * for Supabase Storage.
 */
export async function generateSignedUploadUrl(
  ideaId: string,
  filename: string,
  contentType: string,
  size: number,
): Promise<SignedUploadUrl> {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error('Invalid file type')
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File too large (max 10MB)')
  }

  const supabase = getServiceRoleClient()

  const ext = filename.includes('.') ? filename.split('.').pop() : 'bin'
  const uniqueFilename = `${randomUUID()}.${ext}`
  const path = `${ideaId}/${uniqueFilename}`

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(path)

  if (error || !data) {
    throw error || new Error('Failed to create signed upload URL')
  }

  return {
    uploadUrl: data.signedUrl,
    path: data.path,
    expiresIn: 300, // 5 minutes
  }
}

/**
 * Helper to build a public URL for an uploaded object path.
 * This uses Supabase's public URL helper.
 */
export function getPublicAttachmentUrl(path: string): string {
  const supabase = getServiceRoleClient()
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Simple validation to ensure an attachment URL points at our Supabase
 * Storage bucket. This should be used on the server before persisting
 * attachments supplied by the client.
 */
export function isValidAttachmentUrl(url: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false

  try {
    const u = new URL(url)
    const base = new URL(supabaseUrl)
    // Rough check: same host and contains storage path + bucket name
    return (
      u.host === base.host &&
      u.pathname.includes('/storage/v1/object/public/') &&
      u.pathname.includes(`/idea-attachments/`)
    )
  } catch {
    return false
  }
}
