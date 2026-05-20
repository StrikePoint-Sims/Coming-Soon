'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleCancel() {
    if (submitting) return
    const ok = window.confirm('Cancel this booking? Membership hours are refunded when the session is cancelled more than 12 hours in advance.')
    if (!ok) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: 'Cancelled by customer' }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Could not cancel booking.')
      }

      router.refresh()
      router.push('/account/bookings')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel booking.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-cancel-wrap">
      <button
        className="dash-btn danger mb-action"
        type="button"
        onClick={() => void handleCancel()}
        disabled={submitting}
      >
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h12M6 5V3a1 1 0 011-1h4a1 1 0 011 1v2M5 5l1 10h6l1-10"/>
        </svg>
        {submitting ? 'Cancelling...' : 'Cancel Booking'}
      </button>
      {error && <p className="mb-cancel-error">{error}</p>}
    </div>
  )
}
