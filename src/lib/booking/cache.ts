import type { AvailabilityResponse } from './capacity'
import { facilityDatesForRange } from './capacity'

export interface AvailabilityCache {
  get(key: string): Promise<AvailabilityResponse | null>
  set(key: string, value: AvailabilityResponse, ttlSeconds: number): Promise<void>
  deleteByDate(date: string): Promise<void>
}

// Default TTL — safety net only. Real freshness comes from invalidation on
// write. NEVER trust this cache for booking decisions.
export const DEFAULT_CACHE_TTL_SECONDS = 300

// In-memory implementation. Fine for a single VPS process. For Vercel /
// serverless / multi-instance, swap this for Redis or Upstash KV — keep the
// interface stable.
class InMemoryAvailabilityCache implements AvailabilityCache {
  private store = new Map<string, { value: AvailabilityResponse; expiresAt: number }>()

  async get(key: string) {
    const hit = this.store.get(key)
    if (!hit) return null
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key)
      return null
    }
    return hit.value
  }

  async set(key: string, value: AvailabilityResponse, ttlSeconds: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }

  async deleteByDate(date: string) {
    for (const k of this.store.keys()) {
      if (k.includes(`:${date}:`)) this.store.delete(k)
    }
  }
}

export const availabilityCache: AvailabilityCache = new InMemoryAvailabilityCache()

export function availabilityCacheKey(params: {
  locationId: string
  date: string
  durationMinutes: number
  audienceType?: string
}) {
  const audience = params.audienceType ?? 'public'
  return `availability:${params.locationId}:${params.date}:${params.durationMinutes}:${audience}`
}

export async function clearAvailabilityCacheForDate(date: string) {
  await availabilityCache.deleteByDate(date)
}

export async function clearAvailabilityCacheForRange(startsAt: Date, endsAt: Date) {
  for (const d of facilityDatesForRange(startsAt, endsAt)) {
    await availabilityCache.deleteByDate(d)
  }
}
