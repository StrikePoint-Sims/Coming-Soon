'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Mode = 'choose' | 'email' | 'phone' | 'otp'

interface LoginFormProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}

export function LoginForm({ searchParams: _ }: LoginFormProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('choose')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return '+1' + digits.slice(-10)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn('email', { email, callbackUrl: '/account', redirect: false })
      router.push('/login/check-email')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const e164 = formatPhone(phone)
    if (e164.length !== 12) {
      setError('Enter your 10-digit US phone number.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164 }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Failed to send code.')
        return
      }
      setMode('otp')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const e164 = formatPhone(phone)
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164, code: otp }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; loginToken?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Incorrect code.')
        return
      }
      if (!data.loginToken) {
        setError('Sign-in failed. Please try again.')
        return
      }
      // Exchange the HMAC token for an Auth.js session via the Credentials provider
      const result = await signIn('credentials', { loginToken: data.loginToken, redirect: false })
      if (result?.error) {
        setError('Sign-in failed. Please try again.')
        return
      }
      router.push('/account')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'choose') {
    return (
      <div className="flex flex-col gap-3">
        <Button size="lg" className="w-full" onClick={() => setMode('email')}>
          Continue with email
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={() => setMode('phone')}>
          Continue with phone number
        </Button>
        <p className="text-center text-xs text-[rgba(255,255,255,0.3)] mt-2">
          By continuing, you agree to our{' '}
          <a href="/terms.html" className="text-[rgba(255,255,255,0.5)] underline underline-offset-2">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy-policy.html" className="text-[rgba(255,255,255,0.5)] underline underline-offset-2">
            Privacy Policy
          </a>
        </p>
      </div>
    )
  }

  if (mode === 'email') {
    return (
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoFocus
          required
          error={error}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send sign-in link
        </Button>
        <button type="button" onClick={() => { setMode('choose'); setError('') }}
          className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white text-center">
          ← Back
        </button>
      </form>
    )
  }

  if (mode === 'phone') {
    return (
      <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
        <Input
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(203) 555-0100"
          autoFocus
          required
          hint="US numbers only. We'll send a 6-digit code."
          error={error}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send code
        </Button>
        <button type="button" onClick={() => { setMode('choose'); setError('') }}
          className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white text-center">
          ← Back
        </button>
      </form>
    )
  }

  // OTP entry
  return (
    <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-[rgba(255,255,255,0.6)] text-center">
        Enter the 6-digit code sent to <span className="text-white">{phone}</span>
      </p>
      <Input
        label="Verification code"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        autoFocus
        required
        error={error}
      />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Verify & sign in
      </Button>
      <button type="button" onClick={() => { setMode('phone'); setOtp(''); setError('') }}
        className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white text-center">
        ← Resend code
      </button>
    </form>
  )
}
