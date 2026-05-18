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

const stripePublishableKey = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? ''
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null)

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
      confirmParams: {
        return_url: `${window.location.origin}/book/review?holdId=${encodeURIComponent(holdId)}`,
      },
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
      // If party has guests, send them to the add-guests step first.
      window.location.href = result.partySize > 1
        ? `/book/${result.bookingId}/guests`
        : `/book/${result.bookingId}`
      return
    }

    onError('Payment did not complete. Please try again.')
    setSubmitting(false)
  }

  return (
    <form onSubmit={e => void handleSubmit(e)}>
      <PaymentElement options={{ layout: 'tabs' }} />
      <button type="submit" className="rv-confirm-btn" disabled={!stripe || submitting}>
        {submitting ? 'Processing…' : `Confirm Reservation · $${(pricing.totalCents / 100).toFixed(2)}`}
      </button>
    </form>
  )
}

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
      if (!stripePublishableKey) {
        setPageError('Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and try again.')
        setLoading(false)
        return
      }

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
        <div className="rv-content rv-empty">
          <p>No booking hold found.</p>
          <a href="/book" className="rv-back-link">← Back to booking</a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rv-page">
        <div className="rv-content rv-empty">
          <div className="rv-spinner" />
          <span>Setting up checkout…</span>
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="rv-page">
        <div className="rv-content rv-empty">
          <p className="rv-error">{pageError}</p>
          <a href="/book" className="rv-back-link">← Back to booking</a>
        </div>
      </div>
    )
  }

  return (
    <div className="rv-page">
      <div className="rv-content">

        <button className="rv-back-btn" onClick={() => void handleBack()} disabled={releasingHold}>
          <span>‹</span> Back
        </button>

        <div className="rv-hero">
          <h1 className="rv-title">Review Your Booking</h1>

          <div className="rv-steps">
            <span className="rv-step done">
              <span className="rv-step-num">1</span>
              <span className="rv-step-label">Select Time</span>
            </span>
            <span className="rv-step-line" />
            <span className="rv-step active">
              <span className="rv-step-num">2</span>
              <span className="rv-step-label">Review &amp; Pay</span>
            </span>
          </div>

          <p className="rv-subtitle">Please review your reservation details and complete payment to confirm.</p>
        </div>

        <div className="rv-body">
          {/* ── Left column ───────────────────────────────────────────────── */}
          <div className="rv-left">

            {/* Reservation details */}
            <div className="rv-card">
              <div className="rv-card-head">
                <span className="rv-section-label">YOUR RESERVATION</span>
                <button onClick={() => void handleBack()} className="rv-edit-btn">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 2l3 3L6 13H3v-3L11 2z"/>
                  </svg>
                  Edit
                </button>
              </div>

              {hold && (
                <div className="rv-res-grid">
                  <div className="rv-res-item">
                    <div className="rv-res-icon">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                        <rect x="3" y="4" width="14" height="13" rx="2"/>
                        <path d="M7 2v4M13 2v4M3 9h14"/>
                      </svg>
                    </div>
                    <div>
                      <p className="rv-res-label">Date</p>
                      <p className="rv-res-value">{hold.dateLabel}</p>
                    </div>
                  </div>

                  <div className="rv-res-item">
                    <div className="rv-res-icon">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                        <circle cx="10" cy="10" r="7"/>
                        <path d="M10 6v4l2.5 2.5"/>
                      </svg>
                    </div>
                    <div>
                      <p className="rv-res-label">Time</p>
                      <p className="rv-res-value">{hold.timeRange}</p>
                      <p className="rv-res-sub">({durationHours} hr)</p>
                    </div>
                  </div>

                  <div className="rv-res-item">
                    <div className="rv-res-icon">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                        <rect x="2" y="3" width="16" height="14" rx="2"/>
                        <path d="M2 7h16"/>
                      </svg>
                    </div>
                    <div>
                      <p className="rv-res-label">Bay</p>
                      <p className="rv-res-value">{hold.bayLabel}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment section */}
            <div className="rv-card">
              <div className="rv-card-head">
                <span className="rv-section-label">PAYMENT METHOD</span>
              </div>

              {payError && <p className="rv-pay-error">{payError}</p>}

              {clientSecret && pricing ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#A97845',
                        colorBackground: '#0f0f0f',
                        colorText: '#ffffff',
                        colorTextSecondary: 'rgba(255,255,255,0.5)',
                        colorTextPlaceholder: 'rgba(255,255,255,0.3)',
                        colorDanger: '#e8735a',
                        colorIcon: '#A97845',
                        borderRadius: '10px',
                        fontFamily: 'var(--font-sans)',
                        fontSizeBase: '15px',
                        spacingUnit: '4px',
                      },
                      rules: {
                        '.Input': {
                          border: '1px solid rgba(169, 120, 69, 0.18)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        },
                        '.Input:focus': {
                          border: '1px solid rgba(169, 120, 69, 0.5)',
                          boxShadow: '0 0 0 3px rgba(169, 120, 69, 0.08)',
                        },
                        '.Tab': {
                          border: '1px solid rgba(169, 120, 69, 0.14)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        },
                        '.Tab--selected': {
                          border: '1px solid rgba(169, 120, 69, 0.4)',
                          backgroundColor: 'rgba(169, 120, 69, 0.06)',
                        },
                      },
                    },
                  }}
                >
                  <CheckoutForm holdId={holdId} pricing={pricing} onError={setPayError} />
                </Elements>
              ) : (
                <div className="rv-loading-block">
                  <div className="rv-spinner" />
                </div>
              )}

              <p className="rv-secure-note">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="8" height="6" rx="1"/>
                  <path d="M5 6V4a2 2 0 014 0v2"/>
                </svg>
                Secure payment processed by Stripe. Your card details never touch our servers.
              </p>
            </div>

            {/* Info blocks */}
            <div className="rv-info-row">
              <div className="rv-info-block">
                <div className="rv-info-icon">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 18s6-3 6-8V4l-6-2-6 2v6c0 5 6 8 6 8z"/>
                    <path d="M7 10l2.5 2.5L13 8"/>
                  </svg>
                </div>
                <div>
                  <p className="rv-info-title">Waivers for Guests</p>
                  <p className="rv-info-body">All players must have a signed waiver on file. Guests can complete theirs online before your visit.</p>
                </div>
              </div>
              <div className="rv-info-block">
                <div className="rv-info-icon">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="16" height="11" rx="2"/>
                    <path d="M2 7l8 5 8-5"/>
                  </svg>
                </div>
                <div>
                  <p className="rv-info-title">Access Details</p>
                  <p className="rv-info-body">Your bay access code arrives by SMS 1 hour before your session.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right rail: Order summary ────────────────────────────────── */}
          <aside className="rv-rail">
            <div className="rv-summary">
              <span className="rv-section-label">ORDER SUMMARY</span>

              {pricing ? (
                <>
                  <div className="rv-summary-row">
                    <span>Subtotal</span>
                    <span>${(pricing.subtotalCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="rv-summary-row">
                    <span>Sales Tax (6.35%)</span>
                    <span>${(pricing.taxCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="rv-summary-divider" />
                  <div className="rv-summary-total">
                    <span>Total</span>
                    <span className="rv-total-amount">${(pricing.totalCents / 100).toFixed(2)}</span>
                  </div>
                  <p className="rv-summary-note">All amounts in USD.</p>
                </>
              ) : (
                <p className="rv-summary-note">Calculating…</p>
              )}
            </div>

            <div className="rv-hold-note">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <circle cx="7" cy="7" r="5.5"/>
                <path d="M7 4v3l2 1.5"/>
              </svg>
              Your spot is held for 10 minutes.
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
