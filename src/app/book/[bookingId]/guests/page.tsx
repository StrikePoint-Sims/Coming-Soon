'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addGuestsToBooking } from './actions'
import './guests.css'

interface GuestRow {
  name: string
  phone: string
}

interface BookingMeta {
  partySize: number
  bayLabel: string
  dateLabel: string
  timeRange: string
}

export default function AddGuestsPage() {
  const params = useParams<{ bookingId: string }>()
  const router = useRouter()
  const bookingId = params.bookingId

  const [meta, setMeta] = useState<BookingMeta | null>(null)
  const [guestRows, setGuestRows] = useState<GuestRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadMeta() {
      const res = await fetch(`/api/book/${bookingId}/meta`)
      if (!res.ok) {
        router.replace(`/book/${bookingId}` as never)
        return
      }
      const data = (await res.json()) as BookingMeta
      setMeta(data)
      const guestCount = Math.max(0, data.partySize - 1)
      setGuestRows(Array.from({ length: guestCount }, () => ({ name: '', phone: '' })))
    }
    void loadMeta()
  }, [bookingId, router])

  function updateRow(idx: number, field: keyof GuestRow, value: string) {
    setGuestRows(rows => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  async function handleSubmit() {
    setError('')
    setSubmitting(true)

    const filled = guestRows.filter(r => r.name.trim() && r.phone.trim())
    if (filled.length === 0) {
      setError('Add at least one guest, or skip for now.')
      setSubmitting(false)
      return
    }

    const result = await addGuestsToBooking(bookingId, filled)
    if ('error' in result) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    window.location.href = `/book/${bookingId}`
  }

  function handleSkip() {
    window.location.href = `/book/${bookingId}`
  }

  if (!meta) {
    return (
      <div className="ag-page">
        <div className="ag-content ag-loading">
          <div className="ag-spinner" />
        </div>
      </div>
    )
  }

  const guestCount = Math.max(0, meta.partySize - 1)

  return (
    <div className="ag-page">
      <div className="ag-content">

        <div className="ag-success">
          <div className="ag-check">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="24" cy="24" r="22"/>
              <path d="M14 24l8 8 14-16"/>
            </svg>
          </div>
          <p className="ag-eyebrow">PAYMENT CONFIRMED</p>
          <h1 className="ag-title">Add Your Guests</h1>
          <p className="ag-intro">
            You booked {meta.bayLabel} for {meta.partySize} player{meta.partySize !== 1 ? 's' : ''} on {meta.dateLabel}, {meta.timeRange}.
            <br/>
            Add your {guestCount} guest{guestCount !== 1 ? 's' : ''} below so we can check waivers and send links if needed.
          </p>
        </div>

        <div className="ag-card">
          <p className="ag-section-label">GUEST DETAILS</p>

          {guestRows.map((row, idx) => (
            <div key={idx} className="ag-guest-row">
              <div className="ag-avatar">{(row.name.trim()[0] ?? (idx + 2)).toString().toUpperCase()}</div>
              <div className="ag-fields">
                <div className="ag-field">
                  <label className="ag-label" htmlFor={`g-name-${idx}`}>Guest {idx + 1} Name</label>
                  <input
                    id={`g-name-${idx}`}
                    type="text"
                    className="ag-input"
                    placeholder="Full name"
                    value={row.name}
                    onChange={e => updateRow(idx, 'name', e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="ag-field">
                  <label className="ag-label" htmlFor={`g-phone-${idx}`}>Phone</label>
                  <input
                    id={`g-phone-${idx}`}
                    type="tel"
                    className="ag-input"
                    placeholder="(203) 555-0100"
                    value={row.phone}
                    onChange={e => updateRow(idx, 'phone', e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>
          ))}

          {error && <p className="ag-error">{error}</p>}

          <button
            type="button"
            className="ag-submit"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? 'Saving guests…' : 'Add Guests & Continue'}
          </button>

          <button type="button" className="ag-skip" onClick={handleSkip} disabled={submitting}>
            I&apos;ll add them later
          </button>
        </div>

        <div className="ag-info">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="8"/>
            <path d="M10 6v4M10 14h0"/>
          </svg>
          <p>
            Every visitor needs a current waiver. If a guest doesn&apos;t have one on file, we&apos;ll text them a link to sign before your session.
          </p>
        </div>
      </div>
    </div>
  )
}
