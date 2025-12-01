// Shared types + client-side helpers for file uploads.
// Server-only helpers live in lib/utils/file-upload-server.ts

export interface AttachmentMeta {
  url: string
  filename: string
  type: string
  size: number
}

/**
 * Client-side helper: upload a File directly to Supabase Storage using a
 * signed upload URL created by the server.
 */
export async function uploadToSignedUrl(
  signedUrl: string,
  file: File,
): Promise<void> {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  })

  if (!response.ok) {
    throw new Error('Upload failed')
  }
}
