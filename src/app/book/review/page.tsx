'use client'

import './review.css'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import {
  getHoldDetails,
  createPaymentIntent,
  confirmBookingAfterPayment,
  releaseHold,
  type HoldDetails,
  type PaymentIntentResult,
} from '../actions'

const stripePromise = loadStripe(
  process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? ''
)

// ── Inner checkout form (needs Stripe context) ─────────────────────────────

interface CheckoutFormProps {
  holdId: string
  pricing: PaymentIntentResult
  onError: (msg: string) => void
}

function CheckoutForm({ holdId, pricing, onError }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    onError('')

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      const result = await confirmBookingAfterPayment(holdId, paymentIntent.id)
      if ('error' in result) {
        onError(result.error)
        setSubmitting(false)
        return
      }
      window.location.href = `/book/${result.bookingId}`
      return
    }

    onError('Payment did not complete. Please try again.')
    setSubmitting(false)
  }

  return (
    <form onSubmit={e => void handleSubmit(e)}>
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      <div style={{ height: 24 }} />
      <button
        type="submit"
        className="rv-pay-btn"
        disabled={!stripe || submitting}
        style={{ borderRadius: 14, marginTop: 0 }}
      >
        {submitting ? 'Processing…' : `Confirm & Pay $${(pricing.totalCents / 100).toFixed(2)}`}
      </button>
    </form>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const params = useSearchParams()
  const holdId = params.get('holdId') ?? ''

  const [hold, setHold] = useState<HoldDetails | null>(null)
  const [pricing, setPricing] = useState<PaymentIntentResult | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pageError, setPageError] = useState('')
  const [payError, setPayError] = useState('')
  const [loading, setLoading] = useState(true)
  const [releasingHold, setReleasingHold] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    if (!holdId || initRef.current) return
    initRef.current = true

    async function init() {
      const [detailsRes, piRes] = await Promise.all([
        getHoldDetails(holdId),
        createPaymentIntent(holdId),
      ])

      if ('error' in detailsRes) {
        setPageError(detailsRes.error)
        setLoading(false)
        return
      }

      if ('error' in piRes) {
        setPageError(piRes.error)
        setLoading(false)
        return
      }

      setHold(detailsRes)
      setPricing(piRes)
      setClientSecret(piRes.clientSecret)
      setLoading(false)
    }

    void init()
  }, [holdId])

  async function handleBack() {
    if (releasingHold) return
    setReleasingHold(true)
    if (holdId) await releaseHold(holdId)
    window.location.href = '/book'
  }

  const durationHours = hold ? (hold.durationMinutes / 60).toFixed(1).replace('.0', '') : ''

  if (!holdId) {
    return (
      <div className="rv-page">
        <div className="rv-content">
          <div className="rv-loading">
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No booking hold found.</p>
            <a href="/book" style={{ color: '#D4AF37', fontSize: '0.85rem' }}>← Back to booking</a>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rv-page">
        <div className="rv-content">
          <div className="rv-loading">
            <div className="rv-spinner" />
            <span>Setting up checkout…</span>
          </div>
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="rv-page">
        <div className="rv-content">
          <div className="rv-loading">
            <p className="rv-error" style={{ maxWidth: 420, textAlign: 'center' }}>{pageError}</p>
            <a href="/book" style={{ color: '#D4AF37', fontSize: '0.85rem' }}>← Back to booking</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rv-page">
      <div className="rv-content">

        <button className="rv-back-btn" onClick={() => void handleBack()} disabled={releasingHold}>
          ← Back
        </button>

        <div className="rv-hero">
          <span className="rv-eyebrow">Almost done</span>
          <h1 className="rv-title">Review &amp; Pay</h1>
          <p className="rv-subtitle">Your spot is held for 10 minutes. Complete payment to confirm.</p>
        </div>

        <div className="rv-body">
          {/* ── Left column ───────────────────────────────────────────────── */}
          <div className="rv-left">

            {/* Reservation details */}
            <div className="rv-section">
              <p className="rv-section-title">Reservation Details</p>
              {hold && (
                <table className="rv-details-table">
                  <tbody>
                    <tr>
                      <td className="rv-dt-label">Date</td>
                      <td className="rv-dt-value">{hold.dateLabel}</td>
                    </tr>
                    <tr>
                      <td className="rv-dt-label">Time</td>
                      <td className="rv-dt-value">{hold.timeRange}</td>
                    </tr>
                    <tr>
                      <td className="rv-dt-label">Duration</td>
                      <td className="rv-dt-value">{durationHours} hr</td>
                    </tr>
                    <tr>
                      <td className="rv-dt-label">Bay</td>
                      <td className="rv-dt-value">{hold.bayLabel}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Access & waiver info */}
            <div className="rv-section">
              <p className="rv-section-title">Access &amp; Waiver</p>
              <ul className="rv-checklist">
                <li className="rv-check-item">
                  <span className="rv-check-icon">✓</span>
                  All players must have a signed waiver on file before your session.
                </li>
                <li className="rv-check-item">
                  <span className="rv-check-icon">✓</span>
                  Your bay access code will be sent by SMS 1 hour before your session.
                </li>
                <li className="rv-check-item">
                  <span className="rv-check-icon">✓</span>
                  Cancellations at least 24 hours in advance receive a full refund.
                </li>
              </ul>
            </div>

            {/* Stripe Payment Element */}
            <div className="rv-payment-section">
              <p className="rv-section-title" style={{ marginBottom: 20 }}>Payment</p>

              {payError && <p className="rv-error">{payError}</p>}

              {clientSecret && pricing ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#D4AF37',
                        colorBackground: '#141414',
                        colorText: '#ffffff',
                        colorTextSecondary: 'rgba(255,255,255,0.45)',
                        colorDanger: '#e8735a',
                        borderRadius: '10px',
                        fontFamily: 'var(--font-sans)',
                      },
                    },
                  }}
                >
                  <CheckoutForm
                    holdId={holdId}
                    pricing={pricing}
                    onError={setPayError}
                  />
                </Elements>
              ) : (
                <div className="rv-loading" style={{ minHeight: 120 }}>
                  <div className="rv-spinner" />
                </div>
              )}
            </div>

          </div>

          {/* ── Right rail: Order summary ────────────────────────────────── */}
          <aside className="rv-rail">
            <div className="rv-summary-card">
              <p className="rv-summary-head">Order Summary</p>
              <div className="rv-summary-body">
                {pricing ? (
                  <>
                    <div className="rv-summary-row">
                      <span className="rv-summary-label">Subtotal</span>
                      <span className="rv-summary-value">
                        ${(pricing.subtotalCents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="rv-summary-row">
                      <span className="rv-summary-label">Sales Tax (6.35%)</span>
                      <span className="rv-summary-value">
                        ${(pricing.taxCents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="rv-summary-divider" />
                    <div className="rv-summary-total-row">
                      <span className="rv-summary-total-label">Total</span>
                      <span className="rv-summary-total-value">
                        ${(pricing.totalCents / 100).toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem' }}>
                    Calculating…
                  </p>
                )}
              </div>
              <div className="rv-secure-note">
                <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
                  <path d="M6 1L1 3v4c0 2.76 2.13 5.33 5 6 2.87-.67 5-3.24 5-6V3L6 1z" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" fill="none"/>
                </svg>
                Secure checkout powered by Stripe
              </div>
            </div>
          </aside>
        </div>

      </div>
    </div>
  )
}
