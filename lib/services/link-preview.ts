import { getLinkPreview } from 'link-preview-js'

export interface LinkPreviewData {
  title: string
  description: string
  image: string | null
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  if (!url) return null

  try {
    const preview: any = await getLinkPreview(url, { timeout: 3000 })

    if (!preview || typeof preview !== 'object') {
      return null
    }

    return {
      title: preview.title || url,
      description: preview.description || '',
      image: Array.isArray(preview.images) && preview.images.length > 0 ? preview.images[0] : null,
    }
  } catch (error) {
    console.error('Link preview failed:', error)
    return null
  }
}
