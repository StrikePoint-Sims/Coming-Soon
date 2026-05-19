'use client'

import { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { MEMBERSHIP_PLANS, membershipAmountCents, parseBilling, parsePlanId, type MembershipBilling } from '@/lib/memberships/plans'
import { activateMembershipAfterPayment, createMembershipCheckoutIntent, type MembershipCheckoutIntent } from './actions'

const stripePublishableKey = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? ''
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null)

interface CheckoutClientProps {
  plan: string
  billing: string
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`
}

function MembershipPaymentForm({
  intent,
  onError,
}: {
  intent: MembershipCheckoutIntent
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements || submitting) return

    setSubmitting(true)
    onError('')

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/account/membership-billing`,
      },
    })

    if (error) {
      onError(error.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      const result = await activateMembershipAfterPayment({
        subscriptionId: intent.subscriptionId,
        paymentIntentId: paymentIntent.id,
      })

      if ('error' in result) {
        onError(result.error)
        setSubmitting(false)
        return
      }

      window.location.href = '/account/membership-billing'
      return
    }

    onError('Payment did not complete. Please try again.')
    setSubmitting(false)
  }

  return (
    <form onSubmit={event => void handleSubmit(event)} className="mc-pay-form">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button type="submit" className="mc-submit" disabled={!stripe || submitting}>
        {submitting ? 'Processing...' : `Start Membership - ${(intent.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`}
      </button>
    </form>
  )
}

export function CheckoutClient({ plan: rawPlan, billing: rawBilling }: CheckoutClientProps) {
  const planId = parsePlanId(rawPlan)
  const billing = parseBilling(rawBilling)
  const plan = MEMBERSHIP_PLANS[planId]
  const amountCents = membershipAmountCents(plan, billing)
  const [intent, setIntent] = useState<MembershipCheckoutIntent | null>(null)
  const [pageError, setPageError] = useState('')
  const [payError, setPayError] = useState('')
  const [loading, setLoading] = useState(true)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      if (!stripePublishableKey) {
        setPageError('Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and try again.')
        setLoading(false)
        return
      }

      const result = await createMembershipCheckoutIntent({ plan: planId, billing })
      if ('error' in result) {
        setPageError(result.error)
        setLoading(false)
        return
      }

      setIntent(result)
      setLoading(false)
    }

    void init()
  }, [billing, planId])

  return (
    <div className="mc-page">
      <div className="mc-wrap">
        <a href="/memberships" className="mc-back">Back to plans</a>

        <div className="mc-hero">
          <span className="mc-eyebrow">Membership checkout</span>
          <h1>Review &amp; Pay</h1>
          <p>Join StrikePoint as a {plan.name} member</p>
        </div>

        <div className="mc-grid">
          <section className="mc-panel">
            <div className="mc-panel-head">
              <span>Payment method</span>
              <small>Secure checkout by Stripe</small>
            </div>

            {loading && (
              <div className="mc-loading">
                <div className="mc-spinner" />
                <span>Setting up checkout...</span>
              </div>
            )}

            {pageError && (
              <div className="mc-error">
                <strong>Checkout unavailable</strong>
                <span>{pageError}</span>
              </div>
            )}

            {payError && <p className="mc-pay-error">{payError}</p>}

            {intent && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: intent.clientSecret,
                  appearance: {
                    theme: 'night',
                    variables: {
                      colorPrimary: '#A97845',
                      colorBackground: '#0f0f0f',
                      colorText: '#ffffff',
                      colorTextSecondary: 'rgba(255,255,255,0.55)',
                      colorTextPlaceholder: 'rgba(255,255,255,0.34)',
                      colorDanger: '#e8735a',
                      colorIcon: '#A97845',
                      borderRadius: '10px',
                      fontFamily: 'var(--font-sans)',
                      fontSizeBase: '15px',
                      spacingUnit: '4px',
                    },
                    rules: {
                      '.Input': {
                        border: '1px solid rgba(126, 154, 92, 0.2)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      },
                      '.Input:focus': {
                        border: '1px solid rgba(166, 186, 120, 0.5)',
                        boxShadow: '0 0 0 3px rgba(61, 90, 42, 0.16)',
                      },
                      '.Tab': {
                        border: '1px solid rgba(169, 120, 69, 0.16)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      },
                      '.Tab--selected': {
                        border: '1px solid rgba(126, 154, 92, 0.5)',
                        backgroundColor: 'rgba(61, 90, 42, 0.14)',
                      },
                    },
                  },
                }}
              >
                <MembershipPaymentForm intent={intent} onError={setPayError} />
              </Elements>
            )}

            <p className="mc-secure-note">
              Your card details never touch StrikePoint servers. Membership billing starts immediately after payment succeeds.
            </p>
          </section>

          <aside className="mc-summary">
            <span className="mc-summary-label">Order summary</span>
            <div className="mc-plan-card">
              <div>
                <p className="mc-plan-name">{plan.name}</p>
                <p className="mc-plan-sub">{billing === 'annual' ? 'Annual billing' : 'Monthly billing'}</p>
              </div>
              <div className="mc-price">
                <span>{formatPrice(amountCents)}</span>
                <small>/{billing === 'annual' ? 'yr' : 'mo'}</small>
              </div>
            </div>

            <div className="mc-includes">
              <div>
                <strong>Off-peak access</strong>
                <span>Unlimited</span>
              </div>
              <div>
                <strong>Peak hours</strong>
                <span>{plan.includedPeakHours === 0 ? 'None included' : `${plan.includedPeakHours} hr / month`}</span>
              </div>
              <div>
                <strong>Advance booking</strong>
                <span>{plan.advanceWindowDays} days</span>
              </div>
              <div>
                <strong>Guests</strong>
                <span>Up to 3 per booking</span>
              </div>
            </div>

            {billing === 'annual' && (
              <p className="mc-annual-note">
                Annual pricing equals 10 months and renews yearly.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
