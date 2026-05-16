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
  { minutes: 60,  label: '1 HR' },
  { minutes: 90,  label: '1.5 HR' },
  { minutes: 120, label: '2 HR' },
  { minutes: 180, label: '3 HR' },
]

interface SelectedSlot {
  bayId: string
  bayLabel: string
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
    return { date: dateStr, dayName, dayNum }
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

  // Auto-fetch when date or duration changes
  useEffect(() => {
    void fetchGrid(selectedDate, duration)
  }, [selectedDate, duration, fetchGrid])

  // Resume draft slot after login redirect
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

    // Hold created — go to review
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

  const availableCount = rows.reduce(
    (sum, row) => sum + row.cells.filter(c => c.status === 'available').length,
    0
  )

  const formatTimeRange = (startsAt: string, endsAt: string) => {
    const start = formatInTimeZone(new Date(startsAt), FACILITY_TZ, 'h:mm a')
    const end = formatInTimeZone(new Date(endsAt), FACILITY_TZ, 'h:mm a')
    return `${start} – ${end}`
  }

  const formatDateDisplay = (dateStr: string) =>
    formatInTimeZone(new Date(dateStr + 'T12:00:00Z'), FACILITY_TZ, 'EEE, MMM d')

  const durationLabel = DURATIONS.find(d => d.minutes === duration)?.label ?? `${duration} min`

  // Unique bay list from first row
  const bayHeaders = rows[0]?.cells ?? []

  return (
    <div className="book-page">
      <div className="book-content">

        <div className="book-hero">
          <h1 className="book-title">Book a Bay</h1>
          <p className="book-subtitle">Find a time that fits your schedule.</p>
        </div>

        {/* ── Date scroller ─────────────────────────────────────────────────── */}
        <div className="book-date-row">
          <button
            className="book-date-arrow"
            onClick={() => setDateOffset(o => Math.max(0, o - 7))}
            disabled={dateOffset === 0}
            aria-label="Previous week"
          >
            ‹
          </button>

          {dates.map(({ date, dayName, dayNum }) => (
            <button
              key={date}
              className={`book-date-btn${selectedDate === date ? ' is-selected' : ''}`}
              onClick={() => handleDateChange(date)}
            >
              <span className="book-date-name">{dayName}</span>
              <span className="book-date-num">{dayNum}</span>
            </button>
          ))}

          <button
            className="book-date-arrow"
            onClick={() => setDateOffset(o => o + 7)}
            aria-label="Next week"
          >
            ›
          </button>

          <button
            className="book-date-cal-btn"
            onClick={() => calInputRef.current?.showPicker?.()}
            aria-label="Open calendar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              ref={calInputRef}
              type="date"
              className="book-date-cal-input"
              min={today}
              tabIndex={-1}
              onChange={e => {
                if (!e.target.value) return
                const diffDays = Math.floor(
                  (new Date(e.target.value).getTime() - new Date(today).getTime()) / 86400000
                )
                setDateOffset(Math.max(0, Math.floor(diffDays / 7) * 7))
                handleDateChange(e.target.value)
              }}
            />
          </button>
        </div>

        {/* ── Controls: duration + players ──────────────────────────────────── */}
        <div className="book-controls-row">
          <div className="book-duration-pills">
            {DURATIONS.map(d => (
              <button
                key={d.minutes}
                className={`book-dur-pill${duration === d.minutes ? ' is-active' : ''}`}
                onClick={() => handleDurationChange(d.minutes)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="book-players-stepper">
            <span className="book-players-label">Players</span>
            <button
              className="book-step-btn"
              onClick={() => setPlayers(p => Math.max(1, p - 1))}
              disabled={players <= 1}
              aria-label="Decrease players"
            >
              −
            </button>
            <span className="book-players-count">{players}</span>
            <button
              className="book-step-btn"
              onClick={() => setPlayers(p => Math.min(6, p + 1))}
              disabled={players >= 6}
              aria-label="Increase players"
            >
              +
            </button>
          </div>
        </div>

        {error && (
          <p className="book-error">
            {error}
            {error.toLowerCase().includes('waiver') && (
              <>{' '}<a href="/waiver?callbackUrl=/book" className="book-error-link">Sign waiver →</a></>
            )}
          </p>
        )}

        {/* ── Two-column body ───────────────────────────────────────────────── */}
        <div className="book-body">

          {/* Grid column */}
          <div className="book-grid-col">
            <div className="book-avail-header">
              <span className="book-avail-title">Bay Availability</span>
              {!loading && rows.length > 0 && (
                <span className="book-avail-count">{availableCount} slots open</span>
              )}
            </div>

            {loading ? (
              <div className="book-loading-row">
                <div className="book-spinner" />
                <span>Loading availability…</span>
              </div>
            ) : rows.length === 0 ? (
              <p className="book-no-slots">No times available. Try a different date or duration.</p>
            ) : (
              <div className="book-table-wrap">
                <table className="book-avail-table">
                  <thead>
                    <tr>
                      <th className="book-th-time">Time</th>
                      {bayHeaders.map(cell => (
                        <th key={cell.bayId} className="book-th-bay">{cell.bayLabel}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.startsAt}>
                        <td className="book-td-time">{row.timeLabel}</td>
                        {row.cells.map(cell => {
                          const isSelected =
                            selected?.startsAt === row.startsAt &&
                            selected?.bayId === cell.bayId

                          if (cell.status === 'booked') {
                            return (
                              <td key={cell.bayId} className="book-td-cell">
                                <div className="book-cell-btn is-booked">Booked</div>
                              </td>
                            )
                          }

                          const slotData: SelectedSlot = {
                            bayId: cell.bayId,
                            bayLabel: cell.bayLabel,
                            startsAt: row.startsAt,
                            endsAt: row.endsAt,
                            priceCents: cell.priceCents ?? 0,
                            timeLabel: row.timeLabel,
                          }

                          return (
                            <td key={cell.bayId} className="book-td-cell">
                              <button
                                className={`book-cell-btn is-available${isSelected ? ' is-selected' : ''}`}
                                onClick={() => setSelected(slotData)}
                                disabled={submitting}
                              >
                                <span className="book-cell-price">
                                  ${((cell.priceCents ?? 0) / 100).toFixed(0)}
                                </span>
                                <span className="book-cell-check">{isSelected ? '✓' : '+'}</span>
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Right rail ──────────────────────────────────────────────────── */}
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
                  <p className="book-rail-bay">{selected.bayLabel}</p>

                  <div className="book-rail-divider" />

                  <div className="book-rail-price-row">
                    <span>Subtotal</span>
                    <span className="book-rail-price">
                      ${(selected.priceCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <p className="book-rail-tax-note">Sales tax shown at checkout</p>

                  <button
                    className="book-rail-btn"
                    onClick={() => void handleReserve()}
                    disabled={submitting}
                  >
                    {submitting ? 'Reserving…' : 'Reserve Bay →'}
                  </button>
                </>
              ) : (
                <p className="book-rail-empty">
                  Select an available time to see your booking summary.
                </p>
              )}
            </div>
          </aside>

        </div>
      </div>
    </div>
  )
}
