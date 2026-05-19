import type { Metadata } from 'next'
import { Hanken_Grotesk, Playfair_Display } from 'next/font/google'
import './globals.css'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { PostHogProvider } from '@/components/PostHogProvider'
import { PrivacyConsent } from '@/components/PrivacyConsent'
import { Providers } from '@/components/Providers'
import { Suspense } from 'react'

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'StrikePoint Sims | Indoor Golf Simulator — Connecticut',
  description:
    'Private indoor golf simulator bays in Connecticut. Trackman technology. Memberships and walk-in sessions available.',
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://strikepointsims.com'),
  openGraph: {
    siteName: 'StrikePoint Sims',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${hankenGrotesk.variable} ${playfairDisplay.variable}`}>
        <Suspense>
          <Providers>
            <PostHogProvider>
              {children}
              <ChatWidget />
              <PrivacyConsent />
            </PostHogProvider>
          </Providers>
        </Suspense>
      </body>
    </html>
  )
}
