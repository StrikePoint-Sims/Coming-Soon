'use client'

import './book.css'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { addDays, format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { createHold } from './actions'
import type { GridRow } from '@/lib/booking/availability'

const LOCATION_ID = process.env['NEXT_PUBLIC_LOCATION_ID'] ?? 'loc_main'
const FACILITY_TZ = 'America/New_York'
const DRAFT_KEY = 'book:draft'

const DURATIONS = [
  { minutes: 60,  label: '1 hr' },
  { minutes: 90,  label: '1.5 hr' },
  { minutes: 120, label: '2 hr' },
  { minutes: 180, label: '3 hr' },
]

const PLAYER_COUNTS = [1, 2, 3, 4]

interface SelectedSlot {
  bayId: string   // used internally for hold creation, not shown to customer
  startsAt: string
  endsAt: string
  priceCents: number
  timeLabel: string
}

interface DraftState {
  date: string
  duration: number
  players: number
  slot: SelectedSlot | null
}

function buildDateList(offset: number) {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, offset + i)
    const dateStr = format(d, 'yyyy-MM-dd')
    const idx = offset + i
    const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : format(d, 'EEE')
    const dayNum = format(d, 'd')
    const monthDay = format(d, 'MMM d')
    return { date: dateStr, dayName, dayNum, monthDay }
  })
}

export default function BookPage() {
  const { data: session } = useSession()
  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const [dateOffset, setDateOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(tomorrow)
  const [duration, setDuration] = useState(60)
  const [players, setPlayers] = useState(2)
  const [rows, setRows] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SelectedSlot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const resumedRef = useRef(false)
  const calInputRef = useRef<HTMLInputElement>(null)

  const dates = buildDateList(dateOffset)

  const fetchGrid = useCallback(async (date: string, dur: number) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/book/grid?locationId=${LOCATION_ID}&date=${date}&duration=${dur}`
      )
      const data = await res.json() as { rows?: GridRow[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to load availability.')
      setRows(data.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load availability.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchGrid(selectedDate, duration)
  }, [selectedDate, duration, fetchGrid])

  useEffect(() => {
    if (!session?.user?.id || resumedRef.current) return
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return
    resumedRef.current = true
    try {
      const draft = JSON.parse(raw) as DraftState
      if (draft.date) setSelectedDate(draft.date)
      if (draft.duration) setDuration(draft.duration)
      if (draft.players) setPlayers(draft.players)
      if (draft.slot) {
        setSelected(draft.slot)
        void handleReserve(draft.slot)
      }
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      sessionStorage.removeItem(DRAFT_KEY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  async function handleReserve(slot?: SelectedSlot) {
    const target = slot ?? selected
    if (!target) return
    setSubmitting(true)
    setError('')

    const result = await createHold({
      locationId: LOCATION_ID,
      bayId: target.bayId,
      startsAt: target.startsAt,
      endsAt: target.endsAt,
      partySize: players,
    })

    if ('needsAuth' in result) {
      const draft: DraftState = { date: selectedDate, duration, players, slot: target }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      window.location.href = '/login?callbackUrl=' + encodeURIComponent('/book')
      return
    }

    if ('error' in result) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    window.location.href = `/book/review?holdId=${result.holdId}`
  }

  function handleDateChange(date: string) {
    setSelectedDate(date)
    setSelected(null)
    setRows([])
  }

  function handleDurationChange(dur: number) {
    setDuration(dur)
    setSelected(null)
    setRows([])
  }

  function stepDuration(delta: number) {
    const newDur = Math.max(60, Math.min(240, duration + delta))
    if (newDur === duration) return
    handleDurationChange(newDur)
  }

  const availableCount = rows.reduce(
    (sum, row) => sum + row.cells.filter(c => c.status === 'available').length,
    0
  )
  const availableSlotCount = rows.filter(r => r.cells.some(c => c.status === 'available')).length

  const formatTimeRange = (startsAt: string, endsAt: string) => {
    const start = formatInTimeZone(new Date(startsAt), FACILITY_TZ, 'h:mm a')
    const end = formatInTimeZone(new Date(endsAt), FACILITY_TZ, 'h:mm a')
    return `${start} – ${end}`
  }

  const formatDateDisplay = (dateStr: string) =>
    formatInTimeZone(new Date(dateStr + 'T12:00:00Z'), FACILITY_TZ, 'EEE, MMM d')

  const durationLabel = `${duration / 60} hr`

  return (
    <div className="book-page">
      <div className="book-content">

        {/* ════════════════════════════════════════════════════════════════
            DESKTOP UI  — hidden at ≤640px
        ════════════════════════════════════════════════════════════════ */}
        <div className="book-desktop-ui">

          <div className="book-hero">
            <h1 className="book-title">Book a Bay</h1>
            <p className="book-subtitle">Find a time that fits your schedule.</p>
          </div>

          {/* Date scroller */}
          <div className="book-date-row">
            <button className="book-date-arrow" onClick={() => setDateOffset(o => Math.max(0, o - 7))} disabled={dateOffset === 0} aria-label="Previous week">‹</button>
            {dates.map(({ date, dayName, dayNum }) => (
              <button key={date} className={`book-date-btn${selectedDate === date ? ' is-selected' : ''}`} onClick={() => handleDateChange(date)}>
                <span className="book-date-name">{dayName}</span>
                <span className="book-date-num">{dayNum}</span>
              </button>
            ))}
            <button className="book-date-arrow" onClick={() => setDateOffset(o => o + 7)} aria-label="Next week">›</button>
            <button className="book-date-cal-btn" onClick={() => calInputRef.current?.showPicker?.()} aria-label="Open calendar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input ref={calInputRef} type="date" className="book-date-cal-input" min={today} tabIndex={-1}
                onChange={e => {
                  if (!e.target.value) return
                  const diffDays = Math.floor((new Date(e.target.value).getTime() - new Date(today).getTime()) / 86400000)
                  setDateOffset(Math.max(0, Math.floor(diffDays / 7) * 7))
                  handleDateChange(e.target.value)
                }}
              />
            </button>
          </div>

          {/* Controls */}
          <div className="book-controls-row">
            <div className="book-duration-pills">
              {DURATIONS.map(d => (
                <button key={d.minutes} className={`book-dur-pill${duration === d.minutes ? ' is-active' : ''}`} onClick={() => handleDurationChange(d.minutes)}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="book-players-stepper">
              <span className="book-players-label">Players</span>
              <button className="book-step-btn" onClick={() => setPlayers(p => Math.max(1, p - 1))} disabled={players <= 1} aria-label="Decrease">−</button>
              <span className="book-players-count">{players}</span>
              <button className="book-step-btn" onClick={() => setPlayers(p => Math.min(4, p + 1))} disabled={players >= 4} aria-label="Increase">+</button>
            </div>
          </div>

          {error && (
            <p className="book-error">
              {error}
              {error.toLowerCase().includes('waiver') && <>{' '}<a href="/waiver?callbackUrl=/book" className="book-error-link">Sign waiver →</a></>}
            </p>
          )}

          {/* Two-column body */}
          <div className="book-body">
            <div className="book-grid-col">
              <div className="book-avail-header">
                <span className="book-avail-title">Available Times</span>
                {!loading && rows.length > 0 && <span className="book-avail-count">{availableSlotCount} times open</span>}
              </div>
              {loading ? (
                <div className="book-loading-row"><div className="book-spinner" /><span>Loading availability…</span></div>
              ) : rows.length === 0 ? (
                <p className="book-no-slots">No times available. Try a different date or duration.</p>
              ) : (
                <div className="book-slot-list">
                  {rows.map(row => {
                    const avail = row.cells.filter(c => c.status === 'available')
                    const total = row.cells.length
                    const isBooked = avail.length === 0
                    const isLimited = avail.length === 1
                    const isSelected = selected?.startsAt === row.startsAt
                    const dotCls = isBooked ? 'is-booked' : isLimited ? 'is-limited' : 'is-avail'
                    const price = avail[0]?.priceCents ?? 0
                    return (
                      <button
                        key={row.startsAt}
                        className={`book-slot${isSelected ? ' is-selected' : ''}${isBooked ? ' is-unavail' : ''}`}
                        onClick={() => {
                          if (isBooked) return
                          const bay = avail[0]
                          if (!bay) return
                          setSelected({ bayId: bay.bayId, startsAt: row.startsAt, endsAt: row.endsAt, priceCents: bay.priceCents ?? 0, timeLabel: row.timeLabel })
                        }}
                        disabled={isBooked || submitting}
                      >
                        <span className="book-slot-time">{row.timeLabel}</span>
                        <span className="book-slot-avail">
                          <span className={`book-slot-dot ${dotCls}`} />
                          {isBooked ? 'Fully booked' : `${avail.length} of ${total} bay${total !== 1 ? 's' : ''} available`}
                        </span>
                        {!isBooked && <span className="book-slot-price">${(price / 100).toFixed(0)}</span>}
                        <span className="book-slot-action">
                          {isBooked ? '' : isSelected ? '✓ Selected' : 'Select →'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <aside className="book-rail">
              <div className="book-rail-card">
                <p className="book-rail-label">YOUR BOOKING</p>
                {selected ? (
                  <>
                    <p className="book-rail-date">{formatDateDisplay(selectedDate)}</p>
                    <p className="book-rail-time">{formatTimeRange(selected.startsAt, selected.endsAt)}</p>
                    <div className="book-rail-meta">
                      <span>{durationLabel}</span>
                      <span className="book-rail-dot">·</span>
                      <span>{players} Player{players !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="book-rail-divider" />
                    <div className="book-rail-price-row">
                      <span>Subtotal</span>
                      <span className="book-rail-price">${(selected.priceCents / 100).toFixed(2)}</span>
                    </div>
                    <p className="book-rail-tax-note">Sales tax shown at checkout</p>
                    <button className="book-rail-btn" onClick={() => void handleReserve()} disabled={submitting}>
                      {submitting ? 'Reserving…' : 'Reserve Bay →'}
                    </button>
                  </>
                ) : (
                  <p className="book-rail-empty">Select an available time to see your booking summary.</p>
                )}
              </div>
            </aside>
          </div>
        </div>
        {/* end .book-desktop-ui */}

        {/* ════════════════════════════════════════════════════════════════
            MOBILE UI — single-scroll page, hidden at ≥641px
        ════════════════════════════════════════════════════════════════ */}
        <div className={`book-mobile-ui${selected ? ' has-bar' : ''}`}>

          {/* Page heading */}
          <div className="book-m-hero">
            <h1 className="book-m-title">Book a Bay</h1>
            <p className="book-m-subtitle">Find a time that fits your schedule.</p>
          </div>

          {/* ── Date scroller ───────────────────────────────────────────── */}
          <div className="book-m-date-row">
            <button
              className="book-m-nav-btn"
              onClick={() => setDateOffset(o => Math.max(0, o - 7))}
              disabled={dateOffset === 0}
              aria-label="Previous"
            >
              ‹
            </button>
            <div className="book-m-dates-scroll">
              {dates.map(({ date, dayName, monthDay }) => (
                <button
                  key={date}
                  className={`book-m-date-pill${selectedDate === date ? ' is-selected' : ''}`}
                  onClick={() => handleDateChange(date)}
                >
                  <span className="book-m-date-pill-name">{dayName}</span>
                  <span className="book-m-date-pill-md">{monthDay}</span>
                </button>
              ))}
            </div>
            <button
              className="book-m-nav-btn"
              onClick={() => setDateOffset(o => o + 7)}
              aria-label="Next"
            >
              ›
            </button>
          </div>

          {/* ── Duration ───────────────────────────────────────────────── */}
          <div className="book-m-control-block">
            <span className="book-m-ctrl-label">DURATION</span>
            <div className="book-m-dur-stepper">
              <button
                className="book-m-dur-step-btn"
                onClick={() => stepDuration(-30)}
                disabled={duration <= 60}
                aria-label="Decrease duration"
              >−</button>
              <span className="book-m-dur-value">{durationLabel}</span>
              <button
                className="book-m-dur-step-btn"
                onClick={() => stepDuration(30)}
                disabled={duration >= 240}
                aria-label="Increase duration"
              >+</button>
            </div>
          </div>

          {/* ── Players ────────────────────────────────────────────────── */}
          <div className="book-m-control-block">
            <span className="book-m-ctrl-label">PLAYERS</span>
            <div className="book-m-pill-row">
              {PLAYER_COUNTS.map(n => (
                <button
                  key={n}
                  className={`book-m-pill book-m-pill-num${players === n ? ' is-active' : ''}`}
                  onClick={() => setPlayers(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* ── Available times ─────────────────────────────────────────── */}
          <div className="book-m-times-hdr">
            <span className="book-m-ctrl-label" style={{ margin: 0 }}>AVAILABLE TIMES</span>
            {!loading && rows.length > 0 && (
              <span className="book-m-slots-count">{availableSlotCount} times open</span>
            )}
          </div>

          {error && (
            <p className="book-error" style={{ marginBottom: 16 }}>
              {error}
              {error.toLowerCase().includes('waiver') && (
                <>{' '}<a href="/waiver?callbackUrl=/book" className="book-error-link">Sign waiver →</a></>
              )}
            </p>
          )}

          {loading ? (
            <div className="book-loading-row">
              <div className="book-spinner" />
              <span>Loading availability…</span>
            </div>
          ) : rows.length === 0 ? (
            <p className="book-no-slots">No times available. Try a different date or duration.</p>
          ) : (
            <div className="book-m-slot-list">
              {rows.map(row => {
                const avail = row.cells.filter(c => c.status === 'available')
                const total = row.cells.length
                const isBooked = avail.length === 0
                const isLimited = avail.length === 1
                const isSelected = selected?.startsAt === row.startsAt
                const dotCls = isBooked ? 'is-booked' : isLimited ? 'is-limited' : 'is-avail'

                return (
                  <button
                    key={row.startsAt}
                    className={`book-m-slot${isSelected ? ' is-selected' : ''}${isBooked ? ' is-unavail' : ''}`}
                    onClick={() => {
                      if (isBooked) return
                      const bay = avail[0]
                      if (!bay) return
                      setSelected({
                        bayId: bay.bayId,
                        startsAt: row.startsAt,
                        endsAt: row.endsAt,
                        priceCents: bay.priceCents ?? 0,
                        timeLabel: row.timeLabel,
                      })
                    }}
                    disabled={isBooked}
                  >
                    <span className="book-m-slot-time">{row.timeLabel}</span>
                    <span className="book-m-slot-avail">
                      <span className={`book-m-dot ${dotCls}`} />
                      {isBooked
                        ? 'Booked'
                        : `${avail.length} of ${total} bay${total !== 1 ? 's' : ''} left`}
                    </span>
                    {!isBooked && (
                      <span className="book-m-slot-price">
                        ${((avail[0]?.priceCents ?? 0) / 100).toFixed(0)}
                      </span>
                    )}
                    <span className="book-m-slot-end">
                      {!isBooked && (isSelected ? '✓' : '›')}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Sticky bottom bar (appears when slot selected) ──────────── */}
          {selected && (
            <div className="book-m-bar">
              <div className="book-m-bar-info">
                <span className="book-m-bar-headline">
                  {formatDateDisplay(selectedDate)}, {selected.timeLabel}
                </span>
                <span className="book-m-bar-meta">
                  {durationLabel} · {players} Player{players !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="book-m-bar-cta">
                <span className="book-m-bar-price">
                  ${(selected.priceCents / 100).toFixed(2)}
                </span>
                <button
                  className="book-m-reserve"
                  onClick={() => void handleReserve()}
                  disabled={submitting}
                >
                  {submitting ? 'Reserving…' : 'RESERVE BAY →'}
                </button>
              </div>
            </div>
          )}

        </div>
        {/* end .book-mobile-ui */}

      </div>
    </div>
  )
}
