// Unit tests for pure capacity / overlap logic. Run with:
//   node --test --import tsx src/lib/booking/__tests__/capacity.test.ts
// (or whatever runner the repo adopts later — these are framework-light).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __testing, CAPACITY_TOTAL } from '../capacity'

const { overlaps, maxConsumedInInterval } = __testing

const t = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 1, h, m))

test('half-open overlap: 7:00-8:00 and 8:00-9:00 do not overlap', () => {
  assert.equal(overlaps(t(7), t(8), t(8), t(9)), false)
  assert.equal(overlaps(t(7), t(8, 30), t(8), t(9)), true)
})

test('3 simultaneous bookings allowed; 4th rejected', () => {
  const consumers = [
    { startsAt: t(9), endsAt: t(10) },
    { startsAt: t(9), endsAt: t(10) },
    { startsAt: t(9), endsAt: t(10) },
  ]
  const peak = maxConsumedInInterval(consumers, t(9), t(10), 30)
  assert.equal(peak, 3)
  assert.equal(peak + 1 > CAPACITY_TOTAL, true) // would-be 4th rejected
})

test('long booking checks full interval, not just start', () => {
  // Existing reservation at 8:00–8:30 only. A 7:00–8:30 request should see the
  // conflict in the last slice, not the first.
  const consumers = [
    { startsAt: t(8), endsAt: t(8, 30) },
    { startsAt: t(8), endsAt: t(8, 30) },
    { startsAt: t(8), endsAt: t(8, 30) },
  ]
  const peak = maxConsumedInInterval(consumers, t(7), t(8, 30), 30)
  assert.equal(peak, 3)
})

test('back-to-back bookings: 7-8 and 8-9 both allowed', () => {
  const consumers = [
    { startsAt: t(7), endsAt: t(8) },
    { startsAt: t(7), endsAt: t(8) },
    { startsAt: t(7), endsAt: t(8) },
  ]
  // Request 8–9 should not see the 7–8 bookings as a conflict.
  const peak = maxConsumedInInterval(consumers, t(8), t(9), 30)
  assert.equal(peak, 0)
})

test('non-aligned interval still detects mid-slice conflict', () => {
  const consumers = [
    { startsAt: t(7, 45), endsAt: t(8, 15) },
  ]
  // Slice [7:30, 8:00) and [8:00, 8:30) both touch the consumer.
  const peak = maxConsumedInInterval(consumers, t(7, 30), t(8, 30), 30)
  assert.equal(peak, 1)
})
