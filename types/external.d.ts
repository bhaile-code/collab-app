declare module '@mapbox/mapbox-sdk/services/geocoding' {
  import type { AxiosInstance } from 'axios'

  interface ForwardGeocodeOptions {
    query: string
    limit?: number
  }

  interface ForwardGeocodeRequest {
    forwardGeocode(options: ForwardGeocodeOptions): {
      send(): Promise<{
        body: {
          features: Array<{
            center: [number, number]
            place_name: string
          }>
        }
      }>
    }
  }

  interface GeocodingClient extends ForwardGeocodeRequest {}

  interface GeocodingConfig {
    accessToken: string
  }

  export default function mbxGeocoding(config: GeocodingConfig): GeocodingClient
}

declare module 'link-preview-js' {
  export interface LinkPreviewOptions {
    timeout?: number
  }

  export interface LinkPreviewResponse {
    url: string
    title: string
    description?: string
    images?: string[]
    mediaType?: string
    contentType?: string
  }

  export function getLinkPreview(
    url: string,
    options?: LinkPreviewOptions
  ): Promise<LinkPreviewResponse>
}
