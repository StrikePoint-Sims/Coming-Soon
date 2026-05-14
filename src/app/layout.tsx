import type { Metadata } from 'next'
import './globals.css'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { PostHogProvider } from '@/components/PostHogProvider'
import { Suspense } from 'react'

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
      <body>
        <Suspense>
          <PostHogProvider>
            {children}
            <ChatWidget />
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  )
}
