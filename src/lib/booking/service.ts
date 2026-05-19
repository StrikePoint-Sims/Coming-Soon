// Cache-aware availability read. Use this from API routes / UI loaders.
// Booking creation MUST NOT use this — it must call capacity functions against
// Postgres inside a transaction. See createHold.ts.
import {
  calculateAvailabilityFromDb,
  type AvailabilityResponse,
} from './capacity'
import {
  availabilityCache,
  availabilityCacheKey,
  DEFAULT_CACHE_TTL_SECONDS,
} from './cache'

export async function getAvailability(params: {
  locationId: string
  date: string
  durationMinutes: number
  audienceType?: string
  ttlSeconds?: number
}): Promise<AvailabilityResponse> {
  const key = availabilityCacheKey(params)
  const hit = await availabilityCache.get(key)
  if (hit) return hit
  const fresh = await calculateAvailabilityFromDb({
    locationId: params.locationId,
    date: params.date,
    durationMinutes: params.durationMinutes,
  })
  await availabilityCache.set(key, fresh, params.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS)
  return fresh
}
