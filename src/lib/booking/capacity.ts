import { db } from '@/db'
import { bookings, bookingHolds, bookingBlocks } from '@/db/schema'
import { and, eq, gt, lt, inArray, sql } from 'drizzle-orm'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { calculatePriceCents } from './pricing'

export const FACILITY_TZ = 'America/New_York'
// Three physical bays means three sellable capacity units. Customers reserve
// capacity now; a physical bay is assigned about 1 hour before session start.
export const CAPACITY_TOTAL = 3
export const DEFAULT_SLOT_MINUTES = 30
const OPEN_HOUR = 8
const CLOSE_HOUR = 22

export interface CapacitySlot {
  startsAt: string
  endsAt: string
  spotsRemaining: number
  available: boolean
  priceCents: number
}

export interface AvailabilityResponse {
  date: string
  durationMinutes: number
  capacityTotal: number
  slots: CapacitySlot[]
  generatedAt: string
}

interface Interval { startsAt: Date; endsAt: Date }

// Half-open overlap: [aStart, aEnd) vs [bStart, bEnd).
// 7:00–8:00 and 8:00–9:00 do NOT overlap.
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

// Fetch every interval that consumes capacity on a given UTC day window.
async function loadConsumers(params: {
  locationId: string
  windowStart: Date
  windowEnd: Date
  now: Date
  excludeHoldId?: string
}): Promise<Interval[]> {
  const { locationId, windowStart, windowEnd, now, excludeHoldId } = params

  const [bks, holds, blks] = await Promise.all([
    db
      .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
      .from(bookings)
      .where(and(
        eq(bookings.locationId, locationId),
        // Confirmed bookings, checked_in, and any "pending" booking that has not
        // been cancelled all consume capacity. Cancelled / no_show / completed
        // (in the past) do not block future capacity decisions on this window.
        inArray(bookings.status, ['pending', 'confirmed', 'checked_in']),
        lt(bookings.startsAt, windowEnd),
        gt(bookings.endsAt, windowStart),
      )),
    db
      .select({ startsAt: bookingHolds.startsAt, endsAt: bookingHolds.endsAt })
      .from(bookingHolds)
      .where(and(
        eq(bookingHolds.locationId, locationId),
        eq(bookingHolds.status, 'active'),
        gt(bookingHolds.expiresAt, now),
        lt(bookingHolds.startsAt, windowEnd),
        gt(bookingHolds.endsAt, windowStart),
        excludeHoldId ? sql`${bookingHolds.id} <> ${excludeHoldId}` : undefined,
      )),
    db
      .select({ startsAt: bookingBlocks.startsAt, endsAt: bookingBlocks.endsAt })
      .from(bookingBlocks)
      .where(and(
        eq(bookingBlocks.locationId, locationId),
        lt(bookingBlocks.startsAt, windowEnd),
        gt(bookingBlocks.endsAt, windowStart),
      )),
  ])

  return [...bks, ...holds, ...blks].map(r => ({
    startsAt: new Date(r.startsAt as unknown as string),
    endsAt: new Date(r.endsAt as unknown as string),
  }))
}

// Max capacity consumed across any slice inside [start, end). If any slice
// already hits CAPACITY_TOTAL, the interval is unavailable.
function maxConsumedInInterval(
  consumers: Interval[],
  start: Date,
  end: Date,
  sliceMinutes: number,
): number {
  let peak = 0
  const sliceMs = sliceMinutes * 60_000
  for (let t = start.getTime(); t < end.getTime(); t += sliceMs) {
    const sliceStart = new Date(t)
    const sliceEnd = new Date(Math.min(t + sliceMs, end.getTime()))
    let count = 0
    for (const c of consumers) {
      if (overlaps(sliceStart, sliceEnd, c.startsAt, c.endsAt)) count++
    }
    if (count > peak) peak = count
  }
  return peak
}

// True iff capacityRequired units fit across the entire [startsAt, endsAt).
// MUST be called inside the booking transaction after the advisory lock.
export async function isCapacityAvailable(params: {
  locationId: string
  startsAt: Date
  endsAt: Date
  capacityRequired?: number
  excludeHoldId?: string
  sliceMinutes?: number
}): Promise<boolean> {
  const {
    locationId, startsAt, endsAt,
    capacityRequired = 1,
    excludeHoldId,
    sliceMinutes = DEFAULT_SLOT_MINUTES,
  } = params

  const consumers = await loadConsumers({
    locationId,
    windowStart: startsAt,
    windowEnd: endsAt,
    now: new Date(),
    excludeHoldId,
  })
  const peak = maxConsumedInInterval(consumers, startsAt, endsAt, sliceMinutes)
  return peak + capacityRequired <= CAPACITY_TOTAL
}

// Capacity-based availability for a given local date. Returns slots with
// `spotsRemaining` rather than per-bay results — the customer-facing UI must
// never see bay IDs.
export async function calculateAvailabilityFromDb(params: {
  locationId: string
  date: string // YYYY-MM-DD in FACILITY_TZ
  durationMinutes: number
  sliceMinutes?: number
}): Promise<AvailabilityResponse> {
  const {
    locationId, date, durationMinutes,
    sliceMinutes = DEFAULT_SLOT_MINUTES,
  } = params

  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const now = new Date()

  const dayStartUTC = fromZonedTime(new Date(y, m - 1, d, 0, 0, 0), FACILITY_TZ)
  const dayEndUTC = fromZonedTime(new Date(y, m - 1, d, 23, 59, 59), FACILITY_TZ)

  const consumers = await loadConsumers({
    locationId, windowStart: dayStartUTC, windowEnd: dayEndUTC, now,
  })

  const slots: CapacitySlot[] = []
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    for (const mm of [0, sliceMinutes]) {
      const startET = new Date(y, m - 1, d, h, mm, 0)
      const startUTC = fromZonedTime(startET, FACILITY_TZ)
      if (startUTC <= now) continue
      const endUTC = new Date(startUTC.getTime() + durationMinutes * 60_000)
      const endET = toZonedTime(endUTC, FACILITY_TZ)
      if (endET.getHours() > CLOSE_HOUR ||
          (endET.getHours() === CLOSE_HOUR && endET.getMinutes() > 0)) break

      const peak = maxConsumedInInterval(consumers, startUTC, endUTC, sliceMinutes)
      const spotsRemaining = Math.max(0, CAPACITY_TOTAL - peak)
      slots.push({
        startsAt: startUTC.toISOString(),
        endsAt: endUTC.toISOString(),
        spotsRemaining,
        available: spotsRemaining > 0,
        priceCents: calculatePriceCents(h, mm, durationMinutes, startET.getDay()),
      })
    }
  }

  return {
    date,
    durationMinutes,
    capacityTotal: CAPACITY_TOTAL,
    slots,
    generatedAt: new Date().toISOString(),
  }
}

// Local-date key (YYYY-MM-DD in facility tz) for a UTC instant.
export function facilityDateKey(d: Date): string {
  const z = toZonedTime(d, FACILITY_TZ)
  const yyyy = z.getFullYear()
  const mm = String(z.getMonth() + 1).padStart(2, '0')
  const dd = String(z.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// All local dates touched by an interval (handles cross-midnight reservations).
export function facilityDatesForRange(startsAt: Date, endsAt: Date): string[] {
  const out = new Set<string>()
  out.add(facilityDateKey(startsAt))
  // walk midnights; bookings rarely span >2 days but loop handles it.
  let cursor = new Date(startsAt.getTime())
  while (cursor < endsAt) {
    cursor = new Date(cursor.getTime() + 60 * 60_000)
    out.add(facilityDateKey(cursor))
  }
  out.add(facilityDateKey(endsAt))
  return [...out]
}

// Exposed for tests.
export const __testing = { overlaps, maxConsumedInInterval }
