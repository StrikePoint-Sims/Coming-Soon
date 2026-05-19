import { test } from 'node:test'
import assert from 'node:assert/strict'
import { availabilityCache, availabilityCacheKey, clearAvailabilityCacheForDate } from '../cache'
import type { AvailabilityResponse } from '../capacity'

const sample: AvailabilityResponse = {
  date: '2026-10-15',
  durationMinutes: 60,
  capacityTotal: 3,
  slots: [],
  generatedAt: new Date().toISOString(),
}

test('cache hit returns stored value', async () => {
  const key = availabilityCacheKey({ locationId: 'loc1', date: '2026-10-15', durationMinutes: 60 })
  await availabilityCache.set(key, sample, 60)
  const hit = await availabilityCache.get(key)
  assert.deepEqual(hit, sample)
})

test('deleteByDate clears matching keys', async () => {
  const key = availabilityCacheKey({ locationId: 'loc1', date: '2026-10-16', durationMinutes: 60 })
  await availabilityCache.set(key, { ...sample, date: '2026-10-16' }, 60)
  await clearAvailabilityCacheForDate('2026-10-16')
  const hit = await availabilityCache.get(key)
  assert.equal(hit, null)
})

test('expired entries are not returned', async () => {
  const key = availabilityCacheKey({ locationId: 'loc1', date: '2026-10-17', durationMinutes: 60 })
  await availabilityCache.set(key, { ...sample, date: '2026-10-17' }, 0)
  await new Promise(r => setTimeout(r, 5))
  const hit = await availabilityCache.get(key)
  assert.equal(hit, null)
})
