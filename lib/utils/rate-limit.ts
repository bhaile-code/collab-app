import { NextRequest } from 'next/server'

const requests = new Map<string, number[]>()

/**
 * Simple in-memory rate limiter.
 *
 * @param req      NextRequest (used for IP extraction)
 * @param limit    Max number of requests allowed in the window
 * @param windowMs Window length in milliseconds
 * @returns        true if allowed, false if rate limit exceeded
 */
export function rateLimit(
  req: NextRequest,
  limit = 10,
  windowMs = 60_000,
): boolean {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()
  const windowStart = now - windowMs

  const timestamps = requests.get(ip) || []
  const recentRequests = timestamps.filter((ts) => ts > windowStart)

  if (recentRequests.length >= limit) {
    return false // Rate limit exceeded
  }

  recentRequests.push(now)
  requests.set(ip, recentRequests)
  return true
}
