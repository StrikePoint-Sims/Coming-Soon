import { db } from '@/db'
import { bays, bookings, bookingHolds } from '@/db/schema'
import { eq, and, lt, gt, inArray, ne } from 'drizzle-orm'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { calculatePriceCents } from './pricing'

const FACILITY_TZ = 'America/New_York'
const OPEN_HOUR = 0    // midnight
const CLOSE_HOUR = 24  // midnight next day
const SLOT_INTERVAL = 30  // generate a potential start every 30 min

export interface AvailableSlot {
  bayId: string
  bayLabel: string
  startsAt: string  // ISO UTC
  endsAt: string    // ISO UTC
  startsAtET: string  // formatted for display e.g. "9:00 AM"
}

// Returns all (bay, time) combinations available for a given date and duration.
export async function getAvailableSlots(params: {
  locationId: string
  date: string         // YYYY-MM-DD in ET
  durationMinutes: number
  excludeHoldId?: string
}): Promise<AvailableSlot[]> {
  const { locationId, date, durationMinutes, excludeHoldId } = params

  // Generate candidate slot start times in ET, convert to UTC
  const parts = date.split('-').map(Number)
  const year = parts[0]!
  const month = parts[1]!
  const day = parts[2]!
  const now = new Date()

  const slots: Array<{ startsAt: Date; endsAt: Date; label: string }> = []

  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    for (const m of [0, SLOT_INTERVAL]) {
      const startET = new Date(year, month - 1, day, h, m, 0)
      const startUTC = fromZonedTime(startET, FACILITY_TZ)
      if (startUTC <= now) continue

      const endUTC = new Date(startUTC.getTime() + durationMinutes * 60_000)
      const endET = toZonedTime(endUTC, FACILITY_TZ)

      // Drop slots that would run past closing (CLOSE_HOUR 24 = midnight, never drops)
      if (CLOSE_HOUR < 24 && (endET.getHours() > CLOSE_HOUR || (endET.getHours() === CLOSE_HOUR && endET.getMinutes() > 0))) break

      const label = startET.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
      slots.push({ startsAt: startUTC, endsAt: endUTC, label })
    }
  }

  if (slots.length === 0) return []

  // Active bays for this location
  const locationBays = await db
    .select({ id: bays.id, label: bays.label })
    .from(bays)
    .where(and(eq(bays.locationId, locationId), eq(bays.status, 'active')))

  if (locationBays.length === 0) return []

  // Conflicts: confirmed/pending bookings that touch this day
  const dayStartUTC = fromZonedTime(new Date(year, month - 1, day, 0, 0, 0), FACILITY_TZ)
  const dayEndUTC = fromZonedTime(new Date(year, month - 1, day, 23, 59, 59), FACILITY_TZ)

  const existingBookings = await db
    .select({ bayId: bookings.bayId, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(and(
      eq(bookings.locationId, locationId),
      inArray(bookings.status, ['confirmed', 'pending', 'checked_in']),
      lt(bookings.startsAt, dayEndUTC),
      gt(bookings.endsAt, dayStartUTC),
    ))

  // Conflicts: active (non-expired) holds
  const holdWhere = and(
    eq(bookingHolds.locationId, locationId),
    gt(bookingHolds.expiresAt, now),
    lt(bookingHolds.startsAt, dayEndUTC),
    gt(bookingHolds.endsAt, dayStartUTC),
    excludeHoldId ? ne(bookingHolds.id, excludeHoldId) : undefined,
  )
  const existingHolds = await db
    .select({ bayId: bookingHolds.bayId, startsAt: bookingHolds.startsAt, endsAt: bookingHolds.endsAt })
    .from(bookingHolds)
    .where(holdWhere)

  const overlaps = (
    aStart: Date, aEnd: Date,
    bStart: Date | string, bEnd: Date | string,
  ) => new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart)

  const available: AvailableSlot[] = []

  for (const slot of slots) {
    for (const bay of locationBays) {
      const blocked =
        existingBookings.some(b => b.bayId === bay.id && overlaps(slot.startsAt, slot.endsAt, b.startsAt, b.endsAt)) ||
        existingHolds.some(h => h.bayId === bay.id && overlaps(slot.startsAt, slot.endsAt, h.startsAt, h.endsAt))

      if (!blocked) {
        available.push({
          bayId: bay.id,
          bayLabel: bay.label,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          startsAtET: slot.label,
        })
      }
    }
  }

  return available
}

// ── Grid types ────────────────────────────────────────────────────────────────

export interface GridCell {
  bayId: string
  bayLabel: string
  status: 'available' | 'booked'
  priceCents?: number
}

export interface GridRow {
  startsAt: string   // ISO UTC
  endsAt: string     // ISO UTC
  timeLabel: string  // "9:00 AM"
  startHourET: number
  cells: GridCell[]
}

/**
 * Returns a full time × bay grid including booked cells (for social proof).
 * No auth required — used by the public booking page.
 */
export async function getAvailabilityGrid(params: {
  locationId: string
  date: string          // YYYY-MM-DD in ET
  durationMinutes: number
}): Promise<GridRow[]> {
  const { locationId, date, durationMinutes } = params

  const parts = date.split('-').map(Number)
  const year = parts[0]!
  const month = parts[1]!
  const day = parts[2]!
  const now = new Date()

  // Generate all candidate start times
  const times: Array<{ startsAt: Date; endsAt: Date; label: string; hourET: number; minuteET: number; dayOfWeek: number }> = []

  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    for (const m of [0, SLOT_INTERVAL]) {
      const startET = new Date(year, month - 1, day, h, m, 0)
      const startUTC = fromZonedTime(startET, FACILITY_TZ)
      if (startUTC <= now) continue

      const endUTC = new Date(startUTC.getTime() + durationMinutes * 60_000)
      const endET = toZonedTime(endUTC, FACILITY_TZ)

      if (CLOSE_HOUR < 24 && (endET.getHours() > CLOSE_HOUR || (endET.getHours() === CLOSE_HOUR && endET.getMinutes() > 0))) break

      const label = startET.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
      times.push({ startsAt: startUTC, endsAt: endUTC, label, hourET: h, minuteET: m, dayOfWeek: startET.getDay() })
    }
  }

  if (times.length === 0) return []

  const locationBays = await db
    .select({ id: bays.id, label: bays.label })
    .from(bays)
    .where(and(eq(bays.locationId, locationId), eq(bays.status, 'active')))
    .orderBy(bays.label)

  if (locationBays.length === 0) return []

  const dayStartUTC = fromZonedTime(new Date(year, month - 1, day, 0, 0, 0), FACILITY_TZ)
  const dayEndUTC = fromZonedTime(new Date(year, month - 1, day, 23, 59, 59), FACILITY_TZ)

  const existingBookings = await db
    .select({ bayId: bookings.bayId, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(and(
      eq(bookings.locationId, locationId),
      inArray(bookings.status, ['confirmed', 'pending', 'checked_in']),
      lt(bookings.startsAt, dayEndUTC),
      gt(bookings.endsAt, dayStartUTC),
    ))

  const existingHolds = await db
    .select({ bayId: bookingHolds.bayId, startsAt: bookingHolds.startsAt, endsAt: bookingHolds.endsAt })
    .from(bookingHolds)
    .where(and(
      eq(bookingHolds.locationId, locationId),
      gt(bookingHolds.expiresAt, now),
      lt(bookingHolds.startsAt, dayEndUTC),
      gt(bookingHolds.endsAt, dayStartUTC),
    ))

  const overlaps = (
    aStart: Date, aEnd: Date,
    bStart: Date | string, bEnd: Date | string,
  ) => new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart)

  const rows: GridRow[] = []

  for (const t of times) {
    const cells: GridCell[] = locationBays.map(bay => {
      const blocked =
        existingBookings.some(b => b.bayId === bay.id && overlaps(t.startsAt, t.endsAt, b.startsAt, b.endsAt)) ||
        existingHolds.some(h => h.bayId === bay.id && overlaps(t.startsAt, t.endsAt, h.startsAt, h.endsAt))

      return {
        bayId: bay.id,
        bayLabel: bay.label,
        status: blocked ? 'booked' : 'available',
        priceCents: blocked ? undefined : calculatePriceCents(t.hourET, t.minuteET, durationMinutes, t.dayOfWeek),
      }
    })

    rows.push({
      startsAt: t.startsAt.toISOString(),
      endsAt: t.endsAt.toISOString(),
      timeLabel: t.label,
      startHourET: t.hourET,
      cells,
    })
  }

  return rows
}
