import Stripe from 'stripe'
import { env } from '@/env'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

// ── Idempotency helper ────────────────────────────────────────────────────────

export function stripeOptions(idempotencyKey: string): Stripe.RequestOptions {
  return { idempotencyKey }
}

// ── Money helpers ─────────────────────────────────────────────────────────────

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}
