import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "You're in — StrikePoint Sims",
  robots: { index: false },
}

export default function JoinConfirmedPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#0a0a0a', color: '#fff', fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 52, marginBottom: 24 }}>⛳</div>
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(1.8rem, 5vw, 2.6rem)',
            fontWeight: 600,
            color: '#D4AF37',
            marginBottom: 16,
          }}
        >
          You&apos;re in.
        </h1>
        <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 12 }}>
          Your founding spot is reserved. Check your inbox for a confirmation — we&apos;ll be in touch when we open.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 32 }}>
          Colchester, CT · Fall 2026
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: '#1B4332',
            color: '#D4AF37',
            borderRadius: 8,
            border: '1px solid #D4AF37',
            fontSize: '0.9rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Back to site
        </a>
      </div>
    </main>
  )
}
