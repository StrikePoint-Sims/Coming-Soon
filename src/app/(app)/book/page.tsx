'use client'

import './book.css'
import { useState, useCallback } from 'react'
import { createHold, confirmBooking, releaseHold } from './actions'
import { formatInTimeZone } from 'date-fns-tz'
import { addDays, format } from 'date-fns'

const LOCATION_ID = process.env['NEXT_PUBLIC_LOCATION_ID'] ?? 'loc_main'
const FACILITY_TZ = 'America/New_York'

const DURATIONS = [
  { minutes: 60,  label: '1 hr' },
  { minutes: 90,  label: '1.5 hr' },
  { minutes: 120, label: '2 hr' },
  { minutes: 180, label: '3 hr' },
]

interface Slot {
  bayId: string
  bayLabel: string
  startsAt: string
  endsAt: string
  startsAtET: string
}

type Step = 'pick' | 'confirm' | 'submitting'

export default function BookPage() {
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const [date, setDate] = useState(tomorrow)
  const [duration, setDuration] = useState(60)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('pick')
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [holdId, setHoldId] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    setError('')
    setSlots([])
    setHasSearched(false)
    try {
      const res = await fetch(
        `/api/book/slots?locationId=${LOCATION_ID}&date=${date}&duration=${duration}`,
      )
      const data = await res.json() as { slots?: Slot[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to load times.')
      setSlots(data.slots ?? [])
      setHasSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load available times.')
    } finally {
      setLoading(false)
    }
  }, [date, duration])

  async function handleSlotClick(slot: Slot) {
    setError('')
    const result = await createHold({
      locationId: LOCATION_ID,
      bayId: slot.bayId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    })
    if ('error' in result) { setError(result.error); return }
    setHoldId(result.holdId)
    setSelectedSlot(slot)
    setStep('confirm')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleConfirm() {
    setStep('submitting')
    setError('')
    try {
      await confirmBooking(holdId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed. Please try again.')
      setStep('confirm')
    }
  }

  async function handleBack() {
    if (holdId) await releaseHold(holdId)
    setHoldId('')
    setSelectedSlot(null)
    setStep('pick')
  }

  // Group slots by start time
  const slotsByTime = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    acc[slot.startsAt] = [...(acc[slot.startsAt] ?? []), slot]
    return acc
  }, {})

  const durationLabel = DURATIONS.find(d => d.minutes === duration)?.label ?? `${duration} min`

  if (step === 'submitting') {
    return (
      <div className="book-loading">
        <p className="book-spinner-text">Confirming your booking…</p>
      </div>
    )
  }

  return (
    <div className="book-wrap">
      <div className="book-topbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="/"><img src="/logohorizontal.png" alt="StrikePoint Sims" className="book-topbar-logo" /></a>
        <a href="/account" className="book-topbar-back">← Account</a>
      </div>

      <div className="book-main">

        {/* ── Pick step ─────────────────────────────────────────────────────── */}
        {step === 'pick' && (
          <>
            <h1 className="book-heading">Book a bay</h1>
            <p className="book-subhead">Pick a date and session length, then choose your time.</p>

            {error && <p className="book-error">{error}</p>}

            <div className="book-card">
              <label className="book-label" htmlFor="book-date">Date</label>
              <input
                id="book-date"
                type="date"
                className="book-date-input"
                value={date}
                min={tomorrow}
                onChange={e => {
                  setDate(e.target.value)
                  setSlots([])
                  setHasSearched(false)
                }}
              />

              <div className="book-duration-group">
                <span className="book-label">Session length</span>
                <div className="book-duration-row">
                  {DURATIONS.map(d => (
                    <button
                      key={d.minutes}
                      type="button"
                      className={`book-duration-btn${duration === d.minutes ? ' is-active' : ''}`}
                      onClick={() => {
                        setDuration(d.minutes)
                        setSlots([])
                        setHasSearched(false)
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="book-find-btn"
                onClick={() => void fetchSlots()}
                disabled={loading}
              >
                {loading ? 'Finding times…' : 'Find available times →'}
              </button>
            </div>

            {hasSearched && (
              slots.length === 0 ? (
                <p className="book-no-slots">
                  No available times for this date and length. Try a different day or shorter session.
                </p>
              ) : (
                <>
                  <div className="book-slots-header">
                    <span className="book-slots-date">
                      {formatInTimeZone(new Date(date + 'T12:00:00Z'), FACILITY_TZ, 'EEEE, MMMM d')}
                      {' · '}{durationLabel}
                    </span>
                    <span className="book-slots-count">
                      {Object.keys(slotsByTime).length} times available
                    </span>
                  </div>
                  {Object.entries(slotsByTime).map(([startsAt, timeSlots]) => (
                    <div key={startsAt} className="book-slot-row">
                      <span className="book-slot-time">{timeSlots[0]!.startsAtET}</span>
                      <div className="book-slot-bays">
                        {timeSlots.map(slot => (
                          <button
                            key={slot.bayId}
                            type="button"
                            className="book-slot-btn"
                            onClick={() => void handleSlotClick(slot)}
                          >
                            {slot.bayLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )
            )}
          </>
        )}

        {/* ── Confirm step ──────────────────────────────────────────────────── */}
        {step === 'confirm' && selectedSlot && (
          <>
            <h1 className="book-heading">Confirm your session</h1>
            <p className="book-subhead">Review the details and reserve your bay.</p>

            {error && <p className="book-error">{error}</p>}

            <div className="book-confirm-card">
              <p className="book-confirm-title">Session details</p>
              <table className="book-summary-table">
                <tbody>
                  {([
                    ['Bay', selectedSlot.bayLabel],
                    ['Date', formatInTimeZone(new Date(selectedSlot.startsAt), FACILITY_TZ, 'EEEE, MMMM d')],
                    ['Time', `${formatInTimeZone(new Date(selectedSlot.startsAt), FACILITY_TZ, 'h:mm a')} – ${formatInTimeZone(new Date(selectedSlot.endsAt), FACILITY_TZ, 'h:mm a')}`],
                    ['Length', durationLabel],
                  ] as const).map(([label, value]) => (
                    <tr key={label}>
                      <td className="book-summary-label">{label}</td>
                      <td className="book-summary-value">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="book-fine">
                Your access code arrives by SMS 1 hour before your session. Cancellations at least
                24 hours in advance receive a full refund. Your spot is held for 10 minutes.
              </p>

              <div className="book-confirm-actions">
                <button type="button" className="book-back-btn" onClick={() => void handleBack()}>
                  ← Back
                </button>
                <button type="button" className="book-confirm-btn" onClick={() => void handleConfirm()}>
                  Reserve bay →
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
