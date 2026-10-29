import type { Metadata } from 'next'
import { Hanken_Grotesk, Playfair_Display } from 'next/font/google'
import './globals.css'
import { SiteExperience } from '@/components/SiteExperience'
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
  title: 'StrikePoint Sims | Exploring Possibilities for 2027',
  description:
    'StrikePoint Sims is paused while we explore options for 2027 in the Colchester, Connecticut area. No location or opening date is confirmed.',
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
          <SiteExperience>{children}</SiteExperience>
        </Suspense>
      </body>
    </html>
  )
}
