'use client'

import { useState, useCallback } from 'react'
import { createHold, confirmBooking, releaseHold } from './actions'
import { formatInTimeZone } from 'date-fns-tz'
import { addDays, format } from 'date-fns'

const LOCATION_ID = process.env['NEXT_PUBLIC_LOCATION_ID'] ?? 'loc_main'
const FACILITY_TZ = 'America/New_York'

const DURATIONS = [
  { minutes: 60, label: '60 min' },
  { minutes: 90, label: '90 min' },
  { minutes: 120, label: '2 hr' },
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

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    setError('')
    setSlots([])
    try {
      const res = await fetch(
        `/api/book/slots?locationId=${LOCATION_ID}&date=${date}&duration=${duration}`,
      )
      const data = await res.json() as { slots?: Slot[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to load times.')
      setSlots(data.slots ?? [])
      if ((data.slots ?? []).length === 0) setError('No available times for this date and duration.')
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
  }

  async function handleConfirm() {
    setStep('submitting')
    setError('')
    try {
      await confirmBooking(holdId)
      // confirmBooking redirects on success — no need to handle here
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed.')
      setStep('pick')
      setSelectedSlot(null)
      setHoldId('')
    }
  }

  async function handleBack() {
    if (holdId) await releaseHold(holdId)
    setHoldId('')
    setSelectedSlot(null)
    setStep('pick')
  }

  // Group slots by start time for display
  const slotsByTime = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const key = slot.startsAt
    acc[key] = [...(acc[key] ?? []), slot]
    return acc
  }, {})

  const card: React.CSSProperties = {
    background: '#111', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 24, marginBottom: 16,
  }
  const btn: React.CSSProperties = {
    display: 'block', width: '100%', height: 52, borderRadius: 10,
    background: '#1B4332', color: '#D4AF37', border: '1px solid #D4AF37',
    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit',
  }
  const ghostBtn: React.CSSProperties = {
    ...btn, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.6)', width: 'auto', padding: '0 20px',
  }

  if (step === 'submitting') {
    return (
      <main style={{ minHeight: '100vh', background: '#0a0a0a', padding: '48px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Confirming your booking…</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', padding: '48px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <a href="/account" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>← Account</a>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.875rem', fontWeight: 600, color: '#fff', margin: '16px 0 32px' }}>
          Book a bay
        </h1>

        {error && (
          <p style={{ color: '#e8735a', fontSize: '0.88rem', marginBottom: 16 }}>{error}</p>
        )}

        {step === 'pick' && (
          <>
            <div style={card}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    min={tomorrow}
                    onChange={e => { setDate(e.target.value); setSlots([]) }}
                    style={{ display: 'block', width: '100%', height: 48, borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: '#1a1a1a', color: '#fff', padding: '0 16px', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    Session length
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {DURATIONS.map(d => (
                      <button
                        key={d.minutes}
                        type="button"
                        onClick={() => { setDuration(d.minutes); setSlots([]) }}
                        style={{
                          flex: 1, height: 44, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                          fontWeight: 600, fontSize: '0.88rem',
                          background: duration === d.minutes ? 'rgba(212,175,55,0.1)' : 'transparent',
                          border: `1px solid ${duration === d.minutes ? '#D4AF37' : 'rgba(255,255,255,0.15)'}`,
                          color: duration === d.minutes ? '#D4AF37' : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => void fetchSlots()} style={btn} disabled={loading}>
                  {loading ? 'Finding times…' : 'Find available times →'}
                </button>
              </div>
            </div>

            {slots.length > 0 && (
              <div>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  Available times — {formatInTimeZone(new Date(date + 'T12:00:00Z'), FACILITY_TZ, 'EEEE, MMMM d')}
                </p>
                {Object.entries(slotsByTime).map(([startsAt, timeSlots]) => (
                  <div key={startsAt} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <span style={{ width: 80, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                      {timeSlots[0]!.startsAtET}
                    </span>
                    {timeSlots.map(slot => (
                      <button
                        key={slot.bayId}
                        type="button"
                        onClick={() => void handleSlotClick(slot)}
                        style={{
                          flex: 1, height: 44, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                          fontWeight: 600, fontSize: '0.82rem',
                          background: 'rgba(27,67,50,0.4)', border: '1px solid rgba(212,175,55,0.3)',
                          color: '#D4AF37',
                        }}
                      >
                        {slot.bayLabel}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'confirm' && selectedSlot && (
          <div style={card}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.25rem', color: '#fff', marginBottom: 24 }}>
              Confirm your booking
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              {[
                ['Bay', selectedSlot.bayLabel],
                ['Date', formatInTimeZone(new Date(selectedSlot.startsAt), FACILITY_TZ, 'EEEE, MMMM d')],
                ['Time', `${formatInTimeZone(new Date(selectedSlot.startsAt), FACILITY_TZ, 'h:mm a')} – ${formatInTimeZone(new Date(selectedSlot.endsAt), FACILITY_TZ, 'h:mm a')}`],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>{label}</td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right', color: '#fff', fontSize: '0.9rem' }}>{value}</td>
                </tr>
              ))}
            </table>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, marginBottom: 20 }}>
              Your access code will be sent by SMS 1 hour before your session. Cancellations made at least 24 hours in advance receive a full refund.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => void handleBack()} style={ghostBtn}>← Back</button>
              <button type="button" onClick={() => void handleConfirm()} style={{ ...btn, flex: 1 }}>
                Confirm booking →
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
