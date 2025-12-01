import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding'

const accessToken = process.env.MAPBOX_ACCESS_TOKEN

if (!accessToken) {
  console.warn(
    'MAPBOX_ACCESS_TOKEN is not set. Geocoding will be disabled and will always return null.',
  )
}

const geocodingClient = accessToken
  ? mbxGeocoding({
      accessToken,
    })
  : null

type GeocodeResult = {
  lat: number
  lng: number
  placeName: string
}

const cache = new Map<string, { value: GeocodeResult | null; expiresAt: number }>()

// Default TTL: 1 hour
const DEFAULT_TTL_MS = 60 * 60 * 1000

export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  if (!location.trim()) return null

  // If client not configured (no token), fail gracefully
  if (!geocodingClient) {
    return null
  }

  const cacheKey = location.toLowerCase()
  const now = Date.now()

  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  try {
    const response = await geocodingClient
      .forwardGeocode({
        query: location,
        limit: 1,
      })
      .send()

    const match = response.body.features?.[0]

    if (!match || !Array.isArray(match.center) || match.center.length < 2) {
      cache.set(cacheKey, { value: null, expiresAt: now + DEFAULT_TTL_MS })
      return null
    }

    const [lng, lat] = match.center
    const result: GeocodeResult = {
      lat,
      lng,
      placeName: match.place_name,
    }

    cache.set(cacheKey, { value: result, expiresAt: now + DEFAULT_TTL_MS })
    return result
  } catch (error) {
    console.error('Geocoding failed:', error)
    // Cache failures briefly to avoid hammering API on repeated bad inputs
    cache.set(cacheKey, { value: null, expiresAt: now + 5 * 60 * 1000 })
    return null
  }
}
