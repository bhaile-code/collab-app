const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

if (!accessToken) {
  console.warn(
    'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set. Geocoding will be disabled and will always return null.',
  )
}

type GeocodeResult = {
  lat: number
  lng: number
  placeName: string
}

type MapboxFeature = {
  center: [number, number] // [lng, lat]
  place_name: string
}

type MapboxGeocodeResponse = {
  type: 'FeatureCollection'
  features: MapboxFeature[]
}

const cache = new Map<string, { value: GeocodeResult | null; expiresAt: number }>()

const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour
const FAILURE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  if (!location.trim()) return null

  if (!accessToken) {
    return null
  }

  const cacheKey = location.toLowerCase()
  const now = Date.now()

  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  try {
    const encodedQuery = encodeURIComponent(location)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${accessToken}&limit=1`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`Mapbox API error: ${response.status} ${response.statusText}`)
      cache.set(cacheKey, { value: null, expiresAt: now + FAILURE_TTL_MS })
      return null
    }

    let data: MapboxGeocodeResponse
    try {
      data = await response.json()
    } catch (parseError) {
      console.error('Failed to parse Mapbox API response:', parseError)
      cache.set(cacheKey, { value: null, expiresAt: now + FAILURE_TTL_MS })
      return null
    }

    const match = data.features?.[0]

    if (!match || !Array.isArray(match.center) || match.center.length < 2) {
      cache.set(cacheKey, { value: null, expiresAt: now + DEFAULT_TTL_MS })
      return null
    }

    const [lng, lat] = match.center

    if (typeof lat !== 'number' || typeof lng !== 'number' || !match.place_name) {
      console.error('Invalid coordinate data from Mapbox API:', match)
      cache.set(cacheKey, { value: null, expiresAt: now + FAILURE_TTL_MS })
      return null
    }

    const result: GeocodeResult = {
      lat,
      lng,
      placeName: match.place_name,
    }

    cache.set(cacheKey, { value: result, expiresAt: now + DEFAULT_TTL_MS })
    return result
  } catch (error) {
    console.error('Geocoding failed:', error)
    cache.set(cacheKey, { value: null, expiresAt: now + FAILURE_TTL_MS })
    return null
  }
}
