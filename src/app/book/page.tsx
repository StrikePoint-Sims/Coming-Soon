'use client'

import './book.css'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { addDays, format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

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
  startsAt: string
  endsAt: string
  priceCents: number
  timeLabel: string
}

interface CapacitySlot {
  startsAt: string
  endsAt: string
  spotsRemaining: number
  available: boolean
  priceCents: number
}

interface AvailabilityResponse {
  capacityTotal: number
  slots: CapacitySlot[]
}

interface DraftState {
  date: string
  duration: number
  players: number
  slot: SelectedSlot | null
}

interface BookingWindow {
  maxDays: number
  tierName: string | null
}

const NEXT_TIER_UP: Record<string, { name: string; days: number }> = {
  Practice: { name: 'Standard', days: 10 },
  Standard: { name: 'Elite', days: 14 },
}

function daysBetween(todayISO: string, targetISO: string): number {
  const t1 = new Date(todayISO + 'T00:00:00').getTime()
  const t2 = new Date(targetISO + 'T00:00:00').getTime()
  return Math.round((t2 - t1) / 86400000)
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

type RateCategoryKey = 'night' | 'offPeak' | 'peak'

interface RateCategory {
  key: RateCategoryKey
  label: string
  detail: string
}

const RATE_CATEGORIES: Record<RateCategoryKey, RateCategory> = {
  night: { key: 'night', label: 'Night', detail: '$30 / hr' },
  offPeak: { key: 'offPeak', label: 'Off-peak', detail: '$45 / hr' },
  peak: { key: 'peak', label: 'Peak', detail: '$60 / hr' },
}

function rateCategoryForSlot(slot: CapacitySlot): RateCategory {
  const start = new Date(slot.startsAt)
  const hour = Number(formatInTimeZone(start, FACILITY_TZ, 'H'))
  if (hour >= 22 || hour < 6) return RATE_CATEGORIES.night

  const dayOfWeek = Number(formatInTimeZone(start, FACILITY_TZ, 'i'))
  const isWeekend = dayOfWeek === 6 || dayOfWeek === 7
  if (!isWeekend && hour < 17) return RATE_CATEGORIES.offPeak

  return RATE_CATEGORIES.peak
}

function isSixAm(slot: CapacitySlot): boolean {
  return formatInTimeZone(new Date(slot.startsAt), FACILITY_TZ, 'H:mm') === '6:00'
}

export default function BookPage() {
  const { data: session } = useSession()
  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const [dateOffset, setDateOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(tomorrow)
  const [duration, setDuration] = useState(60)
  const [players, setPlayers] = useState(2)
  const [slots, setSlots] = useState<CapacitySlot[]>([])
  const [capacityTotal, setCapacityTotal] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SelectedSlot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [window_, setWindowInfo] = useState<BookingWindow>({ maxDays: 3, tierName: null })
  const resumedRef = useRef(false)
  const calInputRef = useRef<HTMLInputElement>(null)
  const desktopSlotFrameRef = useRef<HTMLDivElement>(null)
  const mobileSlotFrameRef = useRef<HTMLDivElement>(null)

  const dates = buildDateList(dateOffset)
  const daysOut = daysBetween(today, selectedDate)
  const isPastWindow = daysOut > window_.maxDays

  const fetchGrid = useCallback(async (date: string, dur: number) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/availability?locationId=${LOCATION_ID}&date=${date}&duration=${dur}`
      )
      const data = await res.json() as AvailabilityResponse & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to load availability.')
      setSlots(data.slots ?? [])
      setCapacityTotal(data.capacityTotal ?? 3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load availability.')
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isPastWindow) {
      setSlots([])
      setLoading(false)
      return
    }
    void fetchGrid(selectedDate, duration)
  }, [selectedDate, duration, fetchGrid, isPastWindow])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/me/booking-window')
        if (!res.ok) return
        const data = (await res.json()) as BookingWindow
        setWindowInfo(data)
      } catch { /* ignore — defaults to 3-day non-member window */ }
    })()
  }, [session?.user?.id])

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

  useEffect(() => {
    if (loading || isPastWindow || slots.length === 0) return

    const scrollFrameToSix = (frame: HTMLDivElement | null) => {
      if (!frame) return
      const target = frame.querySelector<HTMLElement>('[data-scroll-anchor="day-start"]')
      if (!target) return
      frame.scrollTop = Math.max(0, target.offsetTop - frame.offsetTop)
    }

    const raf = requestAnimationFrame(() => {
      scrollFrameToSix(desktopSlotFrameRef.current)
      scrollFrameToSix(mobileSlotFrameRef.current)
    })

    return () => cancelAnimationFrame(raf)
  }, [slots, loading, isPastWindow])

  async function handleReserve(slot?: SelectedSlot) {
    const target = slot ?? selected
    if (!target) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: LOCATION_ID,
        startsAt: target.startsAt,
        endsAt: target.endsAt,
        partySize: players,
      }),
    })

    if (res.status === 401) {
      const draft: DraftState = { date: selectedDate, duration, players, slot: target }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      window.location.href = '/login?callbackUrl=' + encodeURIComponent('/book')
      return
    }

    const result = await res.json() as { id?: string; error?: string }
    if (!res.ok || result.error || !result.id) {
      setError(result.error ?? 'Could not reserve that time. Please try again.')
      setSubmitting(false)
      return
    }

    window.location.href = `/book/review?holdId=${result.id}`
  }

  function handleDateChange(date: string) {
    setSelectedDate(date)
    setSelected(null)
    setSlots([])
  }

  function handleDurationChange(dur: number) {
    setDuration(dur)
    setSelected(null)
    setSlots([])
  }

  function stepDuration(delta: number) {
    const newDur = Math.max(60, Math.min(240, duration + delta))
    if (newDur === duration) return
    handleDurationChange(newDur)
  }

  const availableSlotCount = slots.filter(s => s.available).length

  const formatTimeRange = (startsAt: string, endsAt: string) => {
    const start = formatInTimeZone(new Date(startsAt), FACILITY_TZ, 'h:mm a')
    const end = formatInTimeZone(new Date(endsAt), FACILITY_TZ, 'h:mm a')
    return `${start} – ${end}`
  }

  const formatDateDisplay = (dateStr: string) =>
    formatInTimeZone(new Date(dateStr + 'T12:00:00Z'), FACILITY_TZ, 'EEE, MMM d')

  const durationLabel = `${duration / 60} hr`

  const upsell = buildWindowUpsell(window_, daysOut)

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
            <div className="book-control-stepper">
              <span className="book-control-label">Duration</span>
              <button
                className="book-step-btn"
                onClick={() => stepDuration(-30)}
                disabled={duration <= 60}
                aria-label="Decrease duration"
              >−</button>
              <span className="book-control-value">{durationLabel}</span>
              <button
                className="book-step-btn"
                onClick={() => stepDuration(30)}
                disabled={duration >= 240}
                aria-label="Increase duration"
              >+</button>
            </div>
            <div className="book-control-pills">
              <span className="book-control-label">Players</span>
              {PLAYER_COUNTS.map(n => (
                <button
                  key={n}
                  className={`book-pill${players === n ? ' is-active' : ''}`}
                  onClick={() => setPlayers(n)}
                  aria-label={`${n} player${n !== 1 ? 's' : ''}`}
                >
                  {n}
                </button>
              ))}
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
                {!loading && !isPastWindow && slots.length > 0 && <span className="book-avail-count">{availableSlotCount} times open</span>}
              </div>
              {isPastWindow ? (
                <WindowUpsellCard {...upsell} />
              ) : loading ? (
                <div className="book-loading-row"><div className="book-spinner" /><span>Loading availability…</span></div>
              ) : slots.length === 0 ? (
                <p className="book-no-slots">No times available. Try a different date or duration.</p>
              ) : (
                <div className="book-slot-frame" ref={desktopSlotFrameRef}>
                  <div className="book-slot-list">
                  {slots.map((slot, index) => {
                    const isBooked = !slot.available
                    const isLimited = slot.spotsRemaining === 1
                    const isSelected = selected?.startsAt === slot.startsAt
                    const dotCls = isBooked ? 'is-booked' : isLimited ? 'is-limited' : 'is-avail'
                    const price = slot.priceCents
                    const rateCategory = rateCategoryForSlot(slot)
                    const prevRateCategory = index > 0 ? rateCategoryForSlot(slots[index - 1]!) : null
                    const showRateSeparator = !prevRateCategory || prevRateCategory.key !== rateCategory.key
                    const timeLabel = formatInTimeZone(new Date(slot.startsAt), FACILITY_TZ, 'h:mm a')
                    return (
                      <div className="book-slot-item" key={slot.startsAt} data-scroll-anchor={isSixAm(slot) ? 'day-start' : undefined}>
                        {showRateSeparator && (
                          <div className={`book-rate-separator ${rateCategory.key}`}>
                            <span>{rateCategory.label}</span>
                            <small>{rateCategory.detail}</small>
                          </div>
                        )}
                        <button
                        className={`book-slot ${rateCategory.key}${isSelected ? ' is-selected' : ''}${isBooked ? ' is-unavail' : ''}`}
                        onClick={() => {
                          if (isBooked) return
                          setSelected({ startsAt: slot.startsAt, endsAt: slot.endsAt, priceCents: slot.priceCents, timeLabel })
                        }}
                        disabled={isBooked || submitting}
                      >
                        <span className="book-slot-time">{timeLabel}</span>
                        <span className="book-slot-avail">
                          <span className={`book-slot-dot ${dotCls}`} />
                          {isBooked ? 'Fully booked' : `${slot.spotsRemaining} of ${capacityTotal} spot${capacityTotal !== 1 ? 's' : ''} available`}
                        </span>
                        {!isBooked && <span className="book-slot-price">${(price / 100).toFixed(0)}</span>}
                        <span className="book-slot-action">
                          {isBooked ? '' : isSelected ? '✓ Selected' : 'Select →'}
                        </span>
                        </button>
                      </div>
                    )
                  })}
                  </div>
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
            {!loading && !isPastWindow && slots.length > 0 && (
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

          {isPastWindow ? (
            <WindowUpsellCard {...upsell} />
          ) : loading ? (
            <div className="book-loading-row">
              <div className="book-spinner" />
              <span>Loading availability…</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="book-no-slots">No times available. Try a different date or duration.</p>
          ) : (
            <div className="book-m-slot-frame" ref={mobileSlotFrameRef}>
              <div className="book-m-slot-list">
              {slots.map((slot, index) => {
                const isBooked = !slot.available
                const isLimited = slot.spotsRemaining === 1
                const isSelected = selected?.startsAt === slot.startsAt
                const dotCls = isBooked ? 'is-booked' : isLimited ? 'is-limited' : 'is-avail'
                const rateCategory = rateCategoryForSlot(slot)
                const prevRateCategory = index > 0 ? rateCategoryForSlot(slots[index - 1]!) : null
                const showRateSeparator = !prevRateCategory || prevRateCategory.key !== rateCategory.key
                const timeLabel = formatInTimeZone(new Date(slot.startsAt), FACILITY_TZ, 'h:mm a')

                return (
                  <div className="book-m-slot-item" key={slot.startsAt} data-scroll-anchor={isSixAm(slot) ? 'day-start' : undefined}>
                    {showRateSeparator && (
                      <div className={`book-rate-separator ${rateCategory.key}`}>
                        <span>{rateCategory.label}</span>
                        <small>{rateCategory.detail}</small>
                      </div>
                    )}
                    <button
                    className={`book-m-slot ${rateCategory.key}${isSelected ? ' is-selected' : ''}${isBooked ? ' is-unavail' : ''}`}
                    onClick={() => {
                      if (isBooked) return
                      setSelected({
                        startsAt: slot.startsAt,
                        endsAt: slot.endsAt,
                        priceCents: slot.priceCents,
                        timeLabel,
                      })
                    }}
                    disabled={isBooked}
                  >
                    <span className="book-m-slot-time">{timeLabel}</span>
                    <span className="book-m-slot-avail">
                      <span className={`book-m-dot ${dotCls}`} />
                      {isBooked
                        ? 'Booked'
                        : `${slot.spotsRemaining} of ${capacityTotal} spot${capacityTotal !== 1 ? 's' : ''} left`}
                    </span>
                    {!isBooked && (
                      <span className="book-m-slot-price">
                        ${(slot.priceCents / 100).toFixed(0)}
                      </span>
                    )}
                    <span className="book-m-slot-end">
                      {!isBooked && (isSelected ? '✓' : '›')}
                    </span>
                    </button>
                  </div>
                )
              })}
              </div>
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

// ── Window upsell ──────────────────────────────────────────────────────────

interface UpsellContent {
  eyebrow: string
  title: string
  body: string
  ctaLabel: string | null
  ctaHref: string | null
}

function buildWindowUpsell(win: BookingWindow, daysOut: number): UpsellContent {
  if (!win.tierName) {
    return {
      eyebrow: `${win.maxDays}-DAY BOOKING WINDOW`,
      title: 'This date is past the booking window for non-members.',
      body: `Members can book up to 14 days ahead. You picked a date ${daysOut} days out — pick a date within the next ${win.maxDays} day${win.maxDays !== 1 ? 's' : ''}, or take a look at memberships.`,
      ctaLabel: 'See Memberships',
      ctaHref: '/memberships',
    }
  }

  const upgrade = NEXT_TIER_UP[win.tierName]
  if (upgrade) {
    return {
      eyebrow: `${win.tierName.toUpperCase()} BOOKING WINDOW`,
      title: `This date is past your ${win.maxDays}-day window.`,
      body: `${upgrade.name} members can book up to ${upgrade.days} days ahead. Upgrade to ${upgrade.name} to lock in this date.`,
      ctaLabel: `Upgrade to ${upgrade.name}`,
      ctaHref: '/memberships',
    }
  }

  // Elite or unknown — at the ceiling.
  return {
    eyebrow: `${win.maxDays}-DAY BOOKING WINDOW`,
    title: `Booking is open up to ${win.maxDays} days out.`,
    body: 'Pick a date within your booking window.',
    ctaLabel: null,
    ctaHref: null,
  }
}

function WindowUpsellCard({ eyebrow, title, body, ctaLabel, ctaHref }: UpsellContent) {
  return (
    <div className="book-upsell">
      <div className="book-upsell-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M8 12l3 3 5-6"/>
        </svg>
      </div>
      <p className="book-upsell-eyebrow">{eyebrow}</p>
      <h3 className="book-upsell-title">{title}</h3>
      <p className="book-upsell-body">{body}</p>
      {ctaLabel && ctaHref && (
        <a href={ctaHref} className="book-upsell-cta">
          {ctaLabel} <span aria-hidden="true">›</span>
        </a>
      )}
    </div>
  )
}
